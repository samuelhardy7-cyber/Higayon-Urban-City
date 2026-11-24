import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  Award,
  Check,
  Coins,
  Eye,
  GitCompare,
  History,
  Layers,
  Lock,
  Minus,
  Palette,
  Plus,
  RotateCcw,
  Shirt,
  ShoppingBag,
  Sparkles,
  UserCheck,
  X,
} from 'lucide-react';
import {
  createCharacterAnimRuntime,
  stepCharacterAnimRuntime,
  triggerCharacterAction,
  type CharacterAnimState,
} from '../game/characterAnimator';
import {
  applyArticulatedPoseToRig,
  applyCharacterCustomization,
  createCharacterRig,
  type CharacterRig,
} from '../game/characterMesh';
import type { KpTransactionRecord } from '../game/multiplayerTypes';
import {
  ACHIEVEMENT_BADGES,
  CLOTHING_COLOR_SWATCHES,
  HAIR_COLOR_SWATCHES,
  SKIN_TONE_SWATCHES,
  applyShopItemToCustomization,
  normalizeCharacterCustomization,
  type RewardShopCategory,
  type RewardShopItem,
} from '../game/rewardShopCatalog';
import type { CharacterCustomization } from '../game/types';

type ShopTab = RewardShopCategory | 'inventory';
type PreviewPoseOption = 'idle' | 'wave' | 'celebrate' | 'show_accessory' | 'rare_outfit_celebrate';

interface RewardShop3DModalProps {
  knowledgePoints: number;
  lifetimeKpEarned: number;
  ownedItemIds: string[];
  unlockedBadges: string[];
  customization: CharacterCustomization;
  catalogItems: RewardShopItem[];
  authSignedIn: boolean;
  transactions: KpTransactionRecord[];
  onClose: () => void;
  onOpenAuth: () => void;
  onPurchaseItem: (itemId: string) => Promise<void>;
  onEquipItem: (itemId: string) => Promise<void> | void;
  onChangeColors: (
    patch: Partial<
      Pick<
        CharacterCustomization,
        'skinTone' | 'hairColor' | 'jacketColor' | 'pantsColor' | 'shoeColor'
      >
    >,
  ) => Promise<void> | void;
}

function createPreviewShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 60);
  grad.addColorStop(0, 'rgba(8, 12, 22, 0.72)');
  grad.addColorStop(0.6, 'rgba(8, 12, 22, 0.3)');
  grad.addColorStop(1, 'rgba(8, 12, 22, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function isSoftwareGlContext(renderer: THREE.WebGLRenderer): boolean {
  try {
    const gl = renderer.getContext();
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const name = dbg
      ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '')
      : String(gl.getParameter(gl.RENDERER) || '');
    return /swiftshader|llvmpipe|software|mesa offscreen/i.test(name);
  } catch {
    return false;
  }
}

function isShopItemEquipped(c: CharacterCustomization, item: RewardShopItem): boolean {
  const entries = Object.entries(item.patch) as Array<
    [keyof CharacterCustomization, CharacterCustomization[keyof CharacterCustomization]]
  >;
  if (entries.length === 0) return false;
  if (item.subCategory === 'character_preset') {
    return c.characterPresetId === item.patch.characterPresetId;
  }
  return entries.every(([k, val]) => c[k] === val);
}

const RARITY_STYLES: Record<RewardShopItem['rarity'], string> = {
  starter: 'border-slate-500/40 bg-slate-800/80 text-slate-300',
  common: 'border-sky-400/40 bg-sky-500/15 text-sky-300',
  rare: 'border-violet-400/45 bg-violet-500/15 text-violet-300',
  special: 'border-amber-400/55 bg-amber-500/20 text-amber-300',
};

export const RewardShop3DModal: FC<RewardShop3DModalProps> = ({
  knowledgePoints,
  lifetimeKpEarned,
  ownedItemIds,
  unlockedBadges,
  customization,
  catalogItems,
  authSignedIn,
  transactions,
  onClose,
  onOpenAuth,
  onPurchaseItem,
  onEquipItem,
  onChangeColors,
}) => {
  const [activeTab, setActiveTab] = useState<ShopTab>('characters');
  const [ownedOnlyFilter, setOwnedOnlyFilter] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [compareCurrent, setCompareCurrent] = useState(false);
  const [previewPose, setPreviewPose] = useState<PreviewPoseOption>('idle');
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [zoomDistance, setZoomDistance] = useState(3.15);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const previewRigRef = useRef<CharacterRig | null>(null);
  const animRuntimeRef = useRef(createCharacterAnimRuntime());
  const yawRef = useRef(0.35);
  const zoomRef = useRef(3.15);
  const dragPointerIdRef = useRef<number | null>(null);
  const lastDragXRef = useRef(0);

  const normalizedCurrent = useMemo(
    () => normalizeCharacterCustomization(customization),
    [customization],
  );

  const ownedSet = useMemo(() => {
    const s = new Set<string>([
      ...(normalizedCurrent.ownedItemIds || []),
      ...ownedItemIds,
    ]);
    for (const item of catalogItems) {
      if (item.starterOwned) s.add(item.id);
    }
    return s;
  }, [normalizedCurrent.ownedItemIds, ownedItemIds, catalogItems]);

  const selectedItem = useMemo(
    () => catalogItems.find((i) => i.id === selectedItemId) || null,
    [catalogItems, selectedItemId],
  );

  const previewCustomization = useMemo(() => {
    if (!selectedItem || compareCurrent) {
      return normalizedCurrent;
    }
    return applyShopItemToCustomization(normalizedCurrent, selectedItem);
  }, [normalizedCurrent, selectedItem, compareCurrent]);

  // Isolated 3D WebGL preview renderer inside the Reward Studio viewport
  useEffect(() => {
    const host = viewportRef.current;
    if (!host) return;

    const width = Math.max(240, host.clientWidth || 320);
    const height = Math.max(240, host.clientHeight || 340);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance',
      });
    } catch {
      return;
    }

    const softwareGl = isSoftwareGlContext(renderer);
    renderer.setPixelRatio(softwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.domElement.className = 'w-full h-full block';
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1220);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 40);
    camera.position.set(0, 1.32, zoomRef.current);
    camera.lookAt(0, 1.02, 0);

    const hemi = new THREE.HemisphereLight(0xe0f2fe, 0x1e293b, 0.9);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfffbeb, 1.35);
    keyLight.position.set(2.8, 4.2, 3.4);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.65);
    rimLight.position.set(-2.6, 2.4, -2.8);
    scene.add(rimLight);

    // Showroom studio turntable plinth
    const plinthGeo = new THREE.CylinderGeometry(0.95, 1.05, 0.12, 32);
    const plinthMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.42,
      metalness: 0.35,
    });
    const plinth = new THREE.Mesh(plinthGeo, plinthMat);
    plinth.position.set(0, -0.06, 0);
    scene.add(plinth);

    const ringGeo = new THREE.RingGeometry(0.84, 0.92, 40);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, 0.004, 0);
    scene.add(ring);

    const shadowTex = createPreviewShadowTexture();
    const rig = createCharacterRig(shadowTex, false);
    applyCharacterCustomization(rig, previewCustomization);
    // Face camera (+Z) by setting yaw = Math.PI initially + user drag offset
    scene.add(rig.root);
    previewRigRef.current = rig;

    const animRt = createCharacterAnimRuntime();
    animRuntimeRef.current = animRt;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(200, Math.round(entry.contentRect.width));
        const h = Math.max(200, Math.round(entry.contentRect.height));
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    });
    ro.observe(host);

    let rafId = 0;
    let lastTs = performance.now();
    let elapsed = 0;

    const renderLoop = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTs) / 1000));
      lastTs = now;
      elapsed += dt;

      camera.position.set(0, 1.18 + (zoomRef.current - 3.15) * 0.14, zoomRef.current);
      camera.lookAt(0, 1.02, 0);

      stepCharacterAnimRuntime(
        animRt,
        {
          speed: 0,
          vy: 0,
          grounded: true,
          isSprinting: false,
          isMoving: false,
          isDriving: false,
          onStairs: false,
          elapsedTime: elapsed,
        },
        dt,
      );

      applyArticulatedPoseToRig(
        rig,
        animRt.pose,
        0,
        0,
        0,
        Math.PI + yawRef.current,
        0,
        1,
      );

      renderer.render(scene, camera);
      rafId = window.requestAnimationFrame(renderLoop);
    };

    rafId = window.requestAnimationFrame(renderLoop);

    return () => {
      window.cancelAnimationFrame(rafId);
      ro.disconnect();
      previewRigRef.current = null;
      rig.dispose();
      plinthGeo.dispose();
      plinthMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      shadowTex.dispose();
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push live customization changes to the 3D rig immediately
  useEffect(() => {
    if (previewRigRef.current) {
      applyCharacterCustomization(previewRigRef.current, previewCustomization);
    }
  }, [previewCustomization]);

  const handleSelectPose = (pose: PreviewPoseOption) => {
    setPreviewPose(pose);
    const rt = animRuntimeRef.current;
    if (pose === 'idle') {
      rt.actionState = null;
      return;
    }
    const anim: CharacterAnimState = pose;
    triggerCharacterAction(rt, anim, 2.8, false);
  };

  const handleViewportPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    dragPointerIdRef.current = e.pointerId;
    lastDragXRef.current = e.clientX;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleViewportPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragPointerIdRef.current !== e.pointerId) return;
    const dx = e.clientX - lastDragXRef.current;
    lastDragXRef.current = e.clientX;
    yawRef.current += dx * 0.014;
  };

  const handleViewportPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragPointerIdRef.current === e.pointerId) {
      dragPointerIdRef.current = null;
    }
  };

  const adjustZoom = (delta: number) => {
    const next = Math.max(2.1, Math.min(4.6, Number((zoomRef.current + delta).toFixed(2))));
    zoomRef.current = next;
    setZoomDistance(next);
  };

  const visibleItems = useMemo(() => {
    if (activeTab === 'inventory') return [];
    return catalogItems.filter((item) => {
      if (!item.enabled) return false;
      if (item.category !== activeTab) return false;
      if (ownedOnlyFilter && !ownedSet.has(item.id)) return false;
      return true;
    });
  }, [catalogItems, activeTab, ownedOnlyFilter, ownedSet]);

  const ownedInventoryGroups = useMemo(() => {
    const owned = catalogItems.filter((item) => ownedSet.has(item.id));
    return {
      characters: owned.filter((i) => i.category === 'characters'),
      clothing: owned.filter((i) => i.category === 'clothing'),
      accessories: owned.filter((i) => i.category === 'accessories'),
    };
  }, [catalogItems, ownedSet]);

  const handleBuy = async (item: RewardShopItem) => {
    setErrorMessage(null);
    setStatusMessage(null);
    if (!authSignedIn) {
      setErrorMessage('Sign in with Google to spend Knowledge Points and sync your account inventory.');
      return;
    }
    if (knowledgePoints < item.priceKp) {
      setErrorMessage(`Need ${item.priceKp - knowledgePoints} more KP to unlock ${item.name}.`);
      return;
    }
    setBusyItemId(item.id);
    try {
      await onPurchaseItem(item.id);
      setStatusMessage(`Unlocked & equipped ${item.name}!`);
      handleSelectPose(item.rarity === 'special' || item.rarity === 'rare' ? 'rare_outfit_celebrate' : 'celebrate');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to complete purchase.');
    } finally {
      setBusyItemId(null);
    }
  };

  const handleEquip = async (item: RewardShopItem) => {
    setErrorMessage(null);
    setStatusMessage(null);
    setBusyItemId(item.id);
    try {
      await onEquipItem(item.id);
      setStatusMessage(`Equipped ${item.name}`);
      handleSelectPose(item.category === 'accessories' ? 'show_accessory' : 'celebrate');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to equip item.');
    } finally {
      setBusyItemId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-2 sm:p-4"
      style={{ backgroundColor: 'rgba(6, 10, 19, 0.84)' }}
      role="dialog"
      aria-modal="true"
      aria-label="City Reward Center and 3D Character Studio"
      data-testid="reward-shop-modal"
    >
      <div
        className="w-full max-w-6xl h-[92vh] flex flex-col rounded-xl border border-amber-400/30 shadow-2xl overflow-hidden"
        style={{ backgroundColor: 'rgba(15, 23, 42, 0.98)' }}
      >
        {/* Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/20 border border-amber-400/45 flex items-center justify-center text-amber-300">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">
                City Reward Center · 3D Studio
              </div>
              <h2 className="font-display text-base sm:text-lg font-bold text-white leading-tight">
                Characters, Apparel &amp; Knowledge Point Rewards
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div
              data-testid="shop-kp-balance"
              className="flex items-center gap-2 rounded-lg border border-amber-400/45 bg-amber-500/15 px-3 py-1.5"
            >
              <Coins className="w-4 h-4 text-amber-300 shrink-0" />
              <div className="leading-none">
                <div className="font-mono-hud text-sm font-bold text-amber-300 tabular-nums">
                  {knowledgePoints} KP
                </div>
                <div className="text-[10px] text-slate-300 font-mono-hud">
                  Lifetime {lifetimeKpEarned} KP
                </div>
              </div>
            </div>

            {!authSignedIn && (
              <button
                type="button"
                data-testid="shop-signin-btn"
                onClick={onOpenAuth}
                className="px-3 py-1.5 rounded-lg border border-sky-400/50 bg-sky-500/20 text-xs font-semibold text-sky-200 hover:bg-sky-500/30"
              >
                Sign In to Sync &amp; Buy
              </button>
            )}

            <button
              type="button"
              data-testid="reward-shop-close"
              onClick={onClose}
              aria-label="Close Reward Shop"
              className="w-9 h-9 rounded-lg border border-white/15 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-2.5 border-b border-white/10 bg-slate-950/60">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {(
              [
                { id: 'characters', label: 'Characters & Hair', icon: UserCheck },
                { id: 'clothing', label: 'Clothing', icon: Shirt },
                { id: 'accessories', label: 'Accessories', icon: Sparkles },
                { id: 'inventory', label: 'Inventory & Badges', icon: Layers },
              ] as const
            ).map((t) => {
              const Icon = t.icon;
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  data-testid={`shop-tab-${t.id}`}
                  onClick={() => setActiveTab(t.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                    active
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-800/80 text-slate-300 border border-white/10 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          {activeTab !== 'inventory' && (
            <button
              type="button"
              onClick={() => setOwnedOnlyFilter((v) => !v)}
              className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-colors ${
                ownedOnlyFilter
                  ? 'border-emerald-400/50 bg-emerald-500/20 text-emerald-300'
                  : 'border-white/15 bg-slate-900 text-slate-300 hover:text-white'
              }`}
            >
              {ownedOnlyFilter ? 'Showing Owned Only' : 'Show All Items'}
            </button>
          )}
        </div>

        {/* Main Split Body: Left 3D Preview Stage | Right Catalog / Inventory */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12">
          {/* Interactive 3D Viewport */}
          <div className="lg:col-span-5 flex flex-col border-b lg:border-b-0 lg:border-r border-white/10 bg-slate-950/70 min-h-[290px]">
            <div className="flex items-center justify-between gap-2 px-3.5 py-2 border-b border-white/10 text-[11px]">
              <span className="text-slate-300 font-medium truncate">
                {selectedItem
                  ? compareCurrent
                    ? `Comparing Current Equipped Look`
                    : `Previewing: ${selectedItem.name}`
                  : 'Drag to rotate · Scroll or +/- to zoom'}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                {selectedItem && (
                  <button
                    type="button"
                    data-testid="shop-compare-btn"
                    onClick={() => setCompareCurrent((v) => !v)}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-semibold ${
                      compareCurrent
                        ? 'border-sky-400 bg-sky-500/20 text-sky-200'
                        : 'border-white/15 bg-slate-900 text-slate-300 hover:text-white'
                    }`}
                  >
                    <GitCompare className="w-3 h-3" />
                    <span>{compareCurrent ? 'Equipped' : 'Compare'}</span>
                  </button>
                )}
                {selectedItem && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedItemId(null);
                      setCompareCurrent(false);
                    }}
                    title="Reset preview to equipped"
                    className="p-1 rounded border border-white/15 bg-slate-900 text-slate-300 hover:text-white"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Isolated WebGL Canvas Container */}
            <div
              ref={viewportRef}
              data-testid="shop-3d-viewport"
              onPointerDown={handleViewportPointerDown}
              onPointerMove={handleViewportPointerMove}
              onPointerUp={handleViewportPointerUp}
              onPointerCancel={handleViewportPointerUp}
              onWheel={(e) => {
                e.preventDefault();
                adjustZoom(e.deltaY > 0 ? 0.22 : -0.22);
              }}
              className="relative flex-1 min-h-[220px] cursor-grab active:cursor-grabbing select-none overflow-hidden"
            >
              {/* Zoom & Pose Overlay Controls (no backdrop-blur over WebGL) */}
              <div className="absolute top-2.5 right-2.5 flex flex-col gap-1">
                <button
                  type="button"
                  data-testid="shop-zoom-in"
                  onClick={() => adjustZoom(-0.28)}
                  aria-label="Zoom in"
                  className="w-8 h-8 rounded-lg border border-white/20 bg-slate-900/90 text-white flex items-center justify-center hover:bg-slate-800"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  data-testid="shop-zoom-out"
                  onClick={() => adjustZoom(0.28)}
                  aria-label="Zoom out"
                  className="w-8 h-8 rounded-lg border border-white/20 bg-slate-900/90 text-white flex items-center justify-center hover:bg-slate-800"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between gap-1.5 pointer-events-none">
                <div className="pointer-events-auto flex flex-wrap gap-1">
                  {(
                    [
                      { id: 'idle', label: 'Idle' },
                      { id: 'wave', label: 'Wave' },
                      { id: 'celebrate', label: 'Cheer' },
                      { id: 'show_accessory', label: 'Inspect' },
                    ] as const
                  ).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectPose(p.id)}
                      className={`px-2 py-1 rounded text-[10px] font-semibold border transition-colors ${
                        previewPose === p.id
                          ? 'border-amber-400 bg-amber-500 text-slate-950'
                          : 'border-white/15 bg-slate-900/90 text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <span className="text-[10px] font-mono-hud text-slate-400 bg-slate-900/90 border border-white/10 rounded px-1.5 py-0.5">
                  {zoomDistance.toFixed(1)}m
                </span>
              </div>
            </div>
          </div>

          {/* Right Panel: Shop Catalog or Inventory & Badges */}
          <div className="lg:col-span-7 flex flex-col min-h-0">
            {(statusMessage || errorMessage) && (
              <div className="px-4 pt-3">
                {statusMessage && (
                  <div
                    data-testid="shop-status-msg"
                    className="rounded-lg border border-emerald-400/45 bg-emerald-950/60 px-3 py-2 text-xs text-emerald-200 flex items-center justify-between gap-2"
                  >
                    <span>{statusMessage}</span>
                    <button type="button" onClick={() => setStatusMessage(null)}>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                {errorMessage && (
                  <div
                    data-testid="shop-error-msg"
                    className="rounded-lg border border-rose-400/45 bg-rose-950/60 px-3 py-2 text-xs text-rose-200 flex items-center justify-between gap-2"
                  >
                    <span>{errorMessage}</span>
                    <button type="button" onClick={() => setErrorMessage(null)}>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
              {activeTab !== 'inventory' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {visibleItems.map((item) => {
                    const owned = ownedSet.has(item.id);
                    const equipped = isShopItemEquipped(normalizedCurrent, item);
                    const isPreviewing = selectedItemId === item.id && !compareCurrent;
                    const busy = busyItemId === item.id;
                    const canAfford = knowledgePoints >= item.priceKp;

                    return (
                      <div
                        key={item.id}
                        data-testid={`shop-item-${item.id}`}
                        className={`rounded-xl border p-3.5 flex flex-col justify-between gap-3 transition-colors ${
                          isPreviewing
                            ? 'border-amber-400 bg-amber-500/10'
                            : equipped
                              ? 'border-emerald-400/50 bg-emerald-950/25'
                              : 'border-white/12 bg-slate-900/75'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                                  style={{ backgroundColor: item.accentHex }}
                                />
                                <h3 className="font-display text-sm font-bold text-white leading-tight">
                                  {item.name}
                                </h3>
                              </div>
                              <div className="mt-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase">
                                <span className={`px-1.5 py-0.5 rounded border ${RARITY_STYLES[item.rarity]}`}>
                                  {item.rarity}
                                </span>
                                <span className="text-slate-400">
                                  {item.subCategory.replace('_', ' ')}
                                </span>
                              </div>
                            </div>

                            <div className="text-right shrink-0 font-mono-hud">
                              {equipped ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/40 text-[11px] font-bold text-emerald-300">
                                  <Check className="w-3 h-3" />
                                  Equipped
                                </span>
                              ) : owned ? (
                                <span className="px-2 py-0.5 rounded bg-sky-500/20 border border-sky-400/40 text-[11px] font-bold text-sky-300">
                                  Owned
                                </span>
                              ) : (
                                <span
                                  className={`px-2 py-0.5 rounded border text-[11px] font-bold ${
                                    canAfford
                                      ? 'bg-amber-500/20 border-amber-400/45 text-amber-300'
                                      : 'bg-slate-800 border-white/10 text-slate-400'
                                  }`}
                                >
                                  {item.priceKp} KP
                                </span>
                              )}
                            </div>
                          </div>

                          <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                            {item.description}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 pt-1 border-t border-white/10">
                          <button
                            type="button"
                            data-testid={`shop-try-${item.id}`}
                            onClick={() => {
                              setCompareCurrent(false);
                              setSelectedItemId((cur) => (cur === item.id ? null : item.id));
                            }}
                            className={`inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                              isPreviewing
                                ? 'border-sky-400 bg-sky-500/20 text-sky-200'
                                : 'border-white/15 bg-slate-800 text-slate-200 hover:bg-slate-700'
                            }`}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>{isPreviewing ? 'Previewing' : 'Try On'}</span>
                          </button>

                          {owned ? (
                            <button
                              type="button"
                              disabled={equipped || busy}
                              data-testid={`shop-equip-${item.id}`}
                              onClick={() => void handleEquip(item)}
                              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors ${
                                equipped
                                  ? 'bg-slate-800 text-slate-500 cursor-default'
                                  : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                              }`}
                            >
                              {busy ? 'Applying...' : equipped ? 'Equipped' : 'Equip Item'}
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={busy || (authSignedIn && !canAfford)}
                              data-testid={`shop-buy-${item.id}`}
                              onClick={() => void handleBuy(item)}
                              className={`flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors ${
                                !authSignedIn
                                  ? 'bg-sky-500 text-slate-950 hover:bg-sky-400'
                                  : canAfford
                                    ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                                    : 'bg-slate-800 text-slate-500 border border-white/10 cursor-not-allowed'
                              }`}
                            >
                              {!canAfford && authSignedIn && <Lock className="w-3 h-3" />}
                              <span>
                                {busy
                                  ? 'Unlocking...'
                                  : !authSignedIn
                                    ? `Sign In (${item.priceKp} KP)`
                                    : `Buy · ${item.priceKp} KP`}
                              </span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Personal Palette Studio */}
                  <div className="rounded-xl border border-white/12 bg-slate-900/75 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-300">
                      <Palette className="w-4 h-4" />
                      <span>Skin Tone, Hair &amp; Apparel Colors</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <div className="text-[11px] font-semibold text-slate-300 mb-1.5">
                          Skin Tone
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {SKIN_TONE_SWATCHES.map((sw) => {
                            const active = normalizedCurrent.skinTone === sw.color;
                            return (
                              <button
                                key={sw.id}
                                type="button"
                                title={sw.label}
                                onClick={() => void onChangeColors({ skinTone: sw.color })}
                                className={`w-7 h-7 rounded-lg border-2 ${
                                  active ? 'border-white scale-110' : 'border-white/25'
                                }`}
                                style={{ backgroundColor: sw.hex }}
                              />
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <div className="text-[11px] font-semibold text-slate-300 mb-1.5">
                          Hair Color
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {HAIR_COLOR_SWATCHES.map((sw) => {
                            const active = normalizedCurrent.hairColor === sw.color;
                            return (
                              <button
                                key={sw.label}
                                type="button"
                                title={sw.label}
                                onClick={() => void onChangeColors({ hairColor: sw.color })}
                                className={`w-7 h-7 rounded-lg border-2 ${
                                  active ? 'border-white scale-110' : 'border-white/25'
                                }`}
                                style={{ backgroundColor: sw.hex }}
                              />
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <div className="text-[11px] font-semibold text-slate-300 mb-1.5">
                          Top Color
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {CLOTHING_COLOR_SWATCHES.map((sw) => {
                            const active = normalizedCurrent.jacketColor === sw.color;
                            return (
                              <button
                                key={`top_${sw.label}`}
                                type="button"
                                title={sw.label}
                                onClick={() => void onChangeColors({ jacketColor: sw.color })}
                                className={`w-6 h-6 rounded-lg border-2 ${
                                  active ? 'border-white scale-110' : 'border-white/25'
                                }`}
                                style={{ backgroundColor: sw.hex }}
                              />
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <div className="text-[11px] font-semibold text-slate-300 mb-1.5">
                          Trousers Color
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {CLOTHING_COLOR_SWATCHES.map((sw) => {
                            const active = normalizedCurrent.pantsColor === sw.color;
                            return (
                              <button
                                key={`pants_${sw.label}`}
                                type="button"
                                title={sw.label}
                                onClick={() => void onChangeColors({ pantsColor: sw.color })}
                                className={`w-6 h-6 rounded-lg border-2 ${
                                  active ? 'border-white scale-110' : 'border-white/25'
                                }`}
                                style={{ backgroundColor: sw.hex }}
                              />
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Owned Categorized Wardrobe */}
                  <div className="space-y-3">
                    <h3 className="font-display text-sm font-bold text-white">
                      Owned Inventory ({ownedSet.size} items)
                    </h3>
                    {(
                      [
                        { label: 'Characters & Appearance', items: ownedInventoryGroups.characters },
                        { label: 'Clothing', items: ownedInventoryGroups.clothing },
                        { label: 'Accessories', items: ownedInventoryGroups.accessories },
                      ] as const
                    ).map((grp) => (
                      <div key={grp.label} className="space-y-1.5">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                          {grp.label} ({grp.items.length})
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {grp.items.map((item) => {
                            const equipped = isShopItemEquipped(normalizedCurrent, item);
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => void handleEquip(item)}
                                className={`rounded-lg border px-3 py-2 text-left flex items-center justify-between gap-2 transition-colors ${
                                  equipped
                                    ? 'border-emerald-400 bg-emerald-500/15 text-white'
                                    : 'border-white/10 bg-slate-900/75 text-slate-200 hover:bg-slate-800'
                                }`}
                              >
                                <span className="text-xs font-semibold truncate">{item.name}</span>
                                <span className="text-[10px] font-mono-hud text-emerald-300 shrink-0">
                                  {equipped ? 'Equipped' : 'Equip'}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Achievement Badges */}
                  <div className="space-y-2.5">
                    <h3 className="font-display text-sm font-bold text-white flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-amber-400" />
                      <span>Achievement Badges ({unlockedBadges.length}/{ACHIEVEMENT_BADGES.length})</span>
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {ACHIEVEMENT_BADGES.map((badge) => {
                        const unlocked = unlockedBadges.includes(badge.id);
                        return (
                          <div
                            key={badge.id}
                            className={`rounded-lg border p-3 ${
                              unlocked
                                ? 'border-amber-400/45 bg-amber-500/10'
                                : 'border-white/10 bg-slate-900/50 opacity-65'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-white">{badge.name}</span>
                              <span
                                className={`text-[10px] font-mono-hud font-semibold px-1.5 py-0.5 rounded ${
                                  unlocked
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : 'bg-slate-800 text-slate-400'
                                }`}
                              >
                                {unlocked ? 'Unlocked' : 'Locked'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-300 mt-1">{badge.description}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Recent KP Ledger */}
                  <div className="space-y-2">
                    <h3 className="font-display text-sm font-bold text-white flex items-center gap-1.5">
                      <History className="w-4 h-4 text-sky-400" />
                      <span>Recent Knowledge Point Ledger</span>
                    </h3>
                    {transactions.length === 0 ? (
                      <div className="rounded-lg border border-white/10 bg-slate-900/50 p-3 text-xs text-slate-400">
                        Answer learning terminals or unlock rewards to record KP transactions.
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {transactions.slice(0, 12).map((tx) => (
                          <div
                            key={tx.txId}
                            className="rounded-lg border border-white/10 bg-slate-900/75 px-3 py-2 flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="min-w-0">
                              <div className="text-white font-medium truncate">{tx.description}</div>
                              <div className="text-[10px] text-slate-400 font-mono-hud">
                                Balance after: {tx.balanceAfter} KP
                              </div>
                            </div>
                            <span
                              className={`font-mono-hud font-bold shrink-0 ${
                                tx.amount >= 0 ? 'text-emerald-400' : 'text-amber-300'
                              }`}
                            >
                              {tx.amount >= 0 ? `+${tx.amount}` : tx.amount} KP
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
