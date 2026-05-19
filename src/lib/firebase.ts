import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, User as FirebaseUser, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, serverTimestamp, collection, onSnapshot, query, where, updateDoc } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/drive.file');
googleProvider.addScope('https://www.googleapis.com/auth/drive.readonly');

let cachedAccessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

export const getAccessToken = () => cachedAccessToken;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'owner' | 'admin' | 'member';
  photoURL?: string;
  bio?: string;
  skills?: string[];
  experience?: string;
  github?: string;
  telegram?: string;
  specialization?: string;
  education?: string;
  completedProjectsCount?: number;
  lastRequestAt?: any;
  createdAt: any;
  updatedAt: any;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  assigneeId: string;
  deadline: any;
  status: 'pending' | 'signed_off' | 'verified';
  assignedBy: string;
  createdAt: any;
}

export interface ServiceRequest {
  id: string;
  customerName: string;
  customerContact: string;
  projectType: 'web' | 'apk' | 'bot' | 'infra' | 'other';
  description: string;
  status: 'new' | 'reviewing' | 'accepted' | 'rejected';
  createdAt: any;
}

export async function submitServiceRequest(request: Omit<ServiceRequest, 'id' | 'createdAt' | 'status'>, userId?: string) {
  const ref = doc(collection(db, 'serviceRequests'));
  try {
    await setDoc(ref, {
      ...request,
      id: ref.id,
      status: 'new',
      createdAt: serverTimestamp(),
    });

    if (userId) {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        lastRequestAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'serviceRequests');
  }
}

export async function assignTask(task: Omit<Task, 'id' | 'createdAt' | 'status'>) {
  const ref = doc(collection(db, 'tasks'));
  try {
    await setDoc(ref, {
      ...task,
      id: ref.id,
      status: 'pending',
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'tasks');
  }
}

export async function updateTaskStatus(id: string, status: Task['status']) {
  const ref = doc(db, 'tasks', id);
  try {
    await updateDoc(ref, { status });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `tasks/${id}`);
  }
}

export interface SupportMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  isAdmin: boolean;
  createdAt: any;
}

export interface ActivityLog {
  id: string;
  userId: string;
  userEmail: string;
  action: string;
  details: string;
  createdAt: any;
}

export async function sendSupportMessage(msg: Omit<SupportMessage, 'id' | 'createdAt'>) {
  const ref = doc(collection(db, 'supportMessages'));
  try {
    await setDoc(ref, {
      ...msg,
      id: ref.id,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'supportMessages');
  }
}

export async function logActivity(log: Omit<ActivityLog, 'id' | 'createdAt'>) {
  const ref = doc(collection(db, 'activityLogs'));
  try {
    await setDoc(ref, {
      ...log,
      id: ref.id,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    // Silently fail activity logging to not disrupt user experience
    console.warn("Logging failed", error);
  }
}

export async function syncUserProfile(user: FirebaseUser): Promise<UserProfile | null> {
  const userRef = doc(db, 'users', user.uid);
  try {
    const userDoc = await getDoc(userRef);
    if (!userDoc.exists()) {
      // Determine role: Owner email check
      const role = user.email === 'tuyginovsardor36@gmail.com' ? 'owner' : 'member';
      const newProfile: UserProfile = {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || 'Developer',
        role,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(userRef, newProfile);
      return { ...newProfile, createdAt: new Date(), updatedAt: new Date() };
    }
    return userDoc.data() as UserProfile;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
    return null;
  }
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  type: string;
  authorId: string;
  createdAt: any;
}

export async function addProduct(product: Omit<Product, 'id' | 'createdAt'>) {
  const productRef = doc(collection(db, 'products'));
  try {
    await setDoc(productRef, {
      ...product,
      id: productRef.id,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'products');
  }
}

export async function updateProduct(id: string, data: Partial<Product>) {
  const productRef = doc(db, 'products', id);
  try {
    await updateDoc(productRef, data);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `products/${id}`);
  }
}

export async function updateServiceRequestStatus(id: string, status: ServiceRequest['status']) {
  const ref = doc(db, 'serviceRequests', id);
  try {
    await updateDoc(ref, { status });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `serviceRequests/${id}`);
  }
}

export async function deleteProduct(id: string) {
  const productRef = doc(db, 'products', id);
  try {
    const { deleteDoc } = await import('firebase/firestore');
    await deleteDoc(productRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `products/${id}`);
  }
}

export const handleLogout = async () => {
    try {
      await signOut(auth);
      cachedAccessToken = null;
    } catch (error) {
      console.error("Sign out error:", error);
    }
};

export async function googleSignIn(): Promise<{ user: FirebaseUser; accessToken: string } | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  }
}
