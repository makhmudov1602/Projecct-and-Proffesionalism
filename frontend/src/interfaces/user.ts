export interface User {
  id: string | null;
  role: string;
  username: string;
  email: string;
  photoUrl: string;
  createdAt?: string;
}
