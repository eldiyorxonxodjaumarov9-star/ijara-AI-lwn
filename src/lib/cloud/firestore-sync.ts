import {
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";

import {
  accountSyncKey,
  type AccountSyncState,
} from "@/lib/cloud/account-state";
import { db, isFirebaseConfigured } from "@/lib/firebase/config";

function firestoreDocId(email: string) {
  return accountSyncKey(email).replace(/[^a-z0-9@._-]/g, "_");
}

export async function pullFromFirestore(
  email: string
): Promise<AccountSyncState | null> {
  if (!isFirebaseConfigured || !db) return null;
  const snap = await getDoc(
    doc(db, "accountSync", firestoreDocId(email))
  );
  if (!snap.exists()) return null;
  const data = snap.data() as AccountSyncState;
  return data?.updatedAt ? data : null;
}

export async function pushToFirestore(
  email: string,
  state: AccountSyncState
): Promise<boolean> {
  if (!isFirebaseConfigured || !db) return false;
  await setDoc(doc(db, "accountSync", firestoreDocId(email)), state, {
    merge: true,
  });
  return true;
}
