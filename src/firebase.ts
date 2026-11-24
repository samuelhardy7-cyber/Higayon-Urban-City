import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { toPublicQuestion } from './game/questionBank';
import type { QuestionDatabase } from './game/questionTypes';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const db =
  firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();

export async function signInWithGooglePopup(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutFirebase(): Promise<void> {
  await signOut(auth);
}

export function subscribeToAuth(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, cb);
}

export async function syncUserProfileToFirestore(
  user: User,
  role: 'student' | 'teacher',
): Promise<void> {
  if (!user.emailVerified) return;
  const userRef = doc(db, 'users', user.uid);
  try {
    const existing = await getDoc(userRef);
    if (!existing.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        displayName: (user.displayName || user.email || 'Explorer').slice(0, 80),
        email: user.email || '',
        photoURL: (user.photoURL || '').slice(0, 512),
        role,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(
        userRef,
        {
          displayName: (user.displayName || user.email || 'Explorer').slice(0, 80),
          photoURL: (user.photoURL || '').slice(0, 512),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
  }
}

export async function syncTeacherDatabaseToFirestore(database: QuestionDatabase): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) return;

  try {
    const batch = writeBatch(db);

    for (const subj of database.subjects) {
      batch.set(doc(db, 'subjects', subj.id), {
        id: subj.id,
        name: subj.name,
        color: subj.color,
        topics: subj.topics,
        visibility: 'public',
        updatedAt: serverTimestamp(),
      });
    }

    for (const qSet of database.questionSets) {
      batch.set(doc(db, 'questionSets', qSet.id), {
        id: qSet.id,
        name: qSet.name,
        description: qSet.description,
        isActive: qSet.isActive,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    batch.set(doc(db, 'teacherConfig', 'global'), {
      allowRetryOnWrong: database.teacherConfig.allowRetryOnWrong,
      awardCityCashBonus: database.teacherConfig.awardCityCashBonus,
      cashPerPoint: database.teacherConfig.cashPerPoint,
      showExplanationOnWrong: database.teacherConfig.showExplanationOnWrong,
      visibility: 'public',
      updatedAt: serverTimestamp(),
    });

    for (const q of database.questions) {
      const status = q.status || 'active';
      batch.set(doc(db, 'teacherQuestions', q.id), {
        id: q.id,
        authorUid: currentUser.uid,
        subjectId: q.subjectId,
        subjectName: q.subjectName,
        topic: q.topic,
        type: q.type,
        questionText: q.questionText,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC || '',
        optionD: q.optionD || '',
        correctAnswer: q.correctAnswer,
        explanation: q.explanation || '',
        difficulty: q.difficulty,
        points: q.points,
        buildingCategory: q.buildingCategory,
        floorPlacement: q.floorPlacement ?? null,
        questionSetId: q.questionSetId,
        status,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const pub = toPublicQuestion(q);
      batch.set(doc(db, 'publicQuestions', q.id), {
        id: pub.id,
        subjectId: pub.subjectId,
        subjectName: pub.subjectName,
        topic: pub.topic,
        type: pub.type,
        questionText: pub.questionText,
        optionA: pub.optionA,
        optionB: pub.optionB,
        optionC: pub.optionC || '',
        optionD: pub.optionD || '',
        difficulty: pub.difficulty,
        points: pub.points,
        buildingCategory: pub.buildingCategory,
        floorPlacement: pub.floorPlacement ?? null,
        questionSetId: pub.questionSetId,
        status,
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'teacherQuestions');
  }
}

export async function fetchTeacherQuestionsCountFromFirestore(): Promise<number | null> {
  if (!auth.currentUser) return null;
  try {
    const snap = await getDocs(collection(db, 'teacherQuestions'));
    return snap.size;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'teacherQuestions');
  }
}
