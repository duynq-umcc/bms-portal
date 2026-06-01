import { db } from '@/firebase/config'
import { addDoc, updateDoc, deleteDoc, doc, serverTimestamp, collection } from 'firebase/firestore'

export async function addDocument(collectionPath: string, data: object) {
  return addDoc(collection(db, collectionPath), { ...data, createdAt: serverTimestamp() })
}

export async function updateDocument(path: string, data: object) {
  return updateDoc(doc(db, path), { ...data, updatedAt: serverTimestamp() })
}

export async function deleteDocument(path: string) {
  return deleteDoc(doc(db, path))
}
