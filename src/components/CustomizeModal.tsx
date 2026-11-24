import type { FC } from 'react';
import { Check, Shirt, ShoppingBag, Sparkles, X } from 'lucide-react';
import {
  ACCESSORY_CATALOG,
  JACKET_COLOR_SWATCHES,
  OUTFIT_CATALOG,
  PANTS_COLOR_SWATCHES,
  SHOE_COLOR_SWATCHES,
} from '../game/progressionSystem';
import type {
  AccessoryId,
  CharacterCustomization,
  OutfitId,
} from '../game/types';

interface CustomizeModalProps {
  money: number;
  knowledgePoints?: number;
  customization: CharacterCustomization;
  onClose: () => void;
  onOpenRewardShop?: () => void;
  onSelectOutfit: (id: OutfitId) => void;
  onSelectAccessory: (id: AccessoryId) => void;
  onChangeColors: (
    colors: Partial<Pick<CharacterCustomization, 'jacketColor' | 'pantsColor' | 'shoeColor'>>,
  ) => void;
}

function hexToCss(hex: number): string {
  return `#${(hex & 0xffffff).toString(16).padStart(6, '0')}`;
}

export const CustomizeModal: FC<CustomizeModalProps> = ({
  money,
  knowledgePoints = 0,
  customization,
  onClose,
  onOpenRewardShop,
  onSelectOutfit,
  onSelectAccessory,
  onChangeColors,
}) => {
  return (
    <div
      className="fixed top-3 right-3 bottom-3 z-30 w-[calc(100vw-24px)] max-w-[340px] sm:max-w-[368px] flex flex-col rounded-xl border border-white/15 shadow-2xl overflow-hidden"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.94)' }}
      role="dialog"
      aria-modal="false"
      aria-label="Character Customization"
      data-testid="customize-modal"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-400/35 flex items-center justify-center text-amber-400">
            <Shirt className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-display text-base font-bold text-white leading-tight">
              Character Style
            </h2>
            <div className="text-[11px] text-slate-400">
              Live 3D Preview · Cash:{' '}
              <span data-testid="customize-money" className="font-mono-hud text-emerald-400 font-semibold">
                ${money}
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          data-testid="customize-close"
          onClick={onClose}
          aria-label="Close Customization"
          className="w-8 h-8 rounded-lg border border-white/15 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable Options */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {/* Outfits */}
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-400 mb-2">
            Outfit Style
          </div>
          <div className="grid grid-cols-2 gap-2">
            {OUTFIT_CATALOG.map((outfit) => {
              const unlocked = customization.unlockedOutfits.includes(outfit.id);
              const equipped = customization.outfitId === outfit.id;
              const canAfford = money >= outfit.price;
              return (
                <button
                  key={outfit.id}
                  type="button"
                  data-testid={`outfit-${outfit.id}`}
                  disabled={!unlocked && !canAfford}
                  onClick={() => onSelectOutfit(outfit.id)}
                  className={`rounded-lg border px-2.5 py-2 text-left transition-colors ${
                    equipped
                      ? 'border-amber-400 bg-amber-500/15 text-white'
                      : unlocked || canAfford
                        ? 'border-white/10 bg-slate-900/70 text-slate-200 hover:bg-slate-800'
                        : 'border-white/5 bg-slate-900/40 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <div className="text-xs font-semibold truncate">{outfit.label}</div>
                  <div className="text-[10px] font-mono-hud mt-0.5 text-emerald-400">
                    {equipped ? 'Equipped' : unlocked ? 'Owned' : `$${outfit.price}`}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Colors */}
        <div className="border-t border-white/10 pt-3 flex flex-col gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Top / Jacket Color
            </div>
            <div className="flex flex-wrap gap-2">
              {JACKET_COLOR_SWATCHES.map((hex) => {
                const selected = customization.jacketColor === hex;
                return (
                  <button
                    key={hex}
                    type="button"
                    data-testid={`jacket-color-${hex.toString(16)}`}
                    aria-label={`Jacket color ${hexToCss(hex)}`}
                    onClick={() => onChangeColors({ jacketColor: hex })}
                    className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-transform ${
                      selected ? 'border-white scale-110' : 'border-white/25 hover:scale-105'
                    }`}
                    style={{ backgroundColor: hexToCss(hex) }}
                  >
                    {selected && <Check className="w-3.5 h-3.5 text-white drop-shadow" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Pants Color
            </div>
            <div className="flex flex-wrap gap-2">
              {PANTS_COLOR_SWATCHES.map((hex) => {
                const selected = customization.pantsColor === hex;
                return (
                  <button
                    key={hex}
                    type="button"
                    aria-label={`Pants color ${hexToCss(hex)}`}
                    onClick={() => onChangeColors({ pantsColor: hex })}
                    className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-transform ${
                      selected ? 'border-white scale-110' : 'border-white/25 hover:scale-105'
                    }`}
                    style={{ backgroundColor: hexToCss(hex) }}
                  >
                    {selected && <Check className="w-3.5 h-3.5 text-white drop-shadow" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Shoes Color
            </div>
            <div className="flex flex-wrap gap-2">
              {SHOE_COLOR_SWATCHES.map((hex) => {
                const selected = customization.shoeColor === hex;
                return (
                  <button
                    key={hex}
                    type="button"
                    aria-label={`Shoes color ${hexToCss(hex)}`}
                    onClick={() => onChangeColors({ shoeColor: hex })}
                    className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-transform ${
                      selected ? 'border-white scale-110' : 'border-white/25 hover:scale-105'
                    }`}
                    style={{ backgroundColor: hexToCss(hex) }}
                  >
                    {selected && <Check className="w-3.5 h-3.5 text-slate-950 drop-shadow" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Accessories */}
        <div className="border-t border-white/10 pt-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-400 mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Accessories</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {ACCESSORY_CATALOG.map((acc) => {
              const unlocked = customization.unlockedAccessories.includes(acc.id);
              const equipped = customization.accessoryId === acc.id;
              const canAfford = money >= acc.price;
              return (
                <button
                  key={acc.id}
                  type="button"
                  data-testid={`accessory-${acc.id}`}
                  disabled={!unlocked && !canAfford}
                  onClick={() => onSelectAccessory(acc.id)}
                  className={`rounded-lg border px-2.5 py-2 text-left transition-colors ${
                    equipped
                      ? 'border-amber-400 bg-amber-500/15 text-white'
                      : unlocked || canAfford
                        ? 'border-white/10 bg-slate-900/70 text-slate-200 hover:bg-slate-800'
                        : 'border-white/5 bg-slate-900/40 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <div className="text-xs font-semibold truncate">{acc.label}</div>
                  <div className="text-[10px] font-mono-hud mt-0.5 text-emerald-400">
                    {equipped ? 'Equipped' : unlocked ? 'Owned' : `$${acc.price}`}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="px-4 py-3 border-t border-white/10 space-y-2">
        {onOpenRewardShop && (
          <button
            type="button"
            data-testid="customize-open-shop"
            onClick={onOpenRewardShop}
            className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-lg border border-amber-400/45 bg-amber-500/15 text-amber-300 font-semibold text-xs hover:bg-amber-500/25 transition-colors"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Open 3D Reward Studio ({knowledgePoints} KP)</span>
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-lg bg-amber-500 text-slate-950 font-semibold text-sm hover:bg-amber-400 transition-colors"
        >
          Done Styling
        </button>
      </div>
    </div>
  );
};
