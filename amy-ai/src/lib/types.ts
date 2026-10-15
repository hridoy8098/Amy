// Types mirroring the FastAPI backend schemas (models: UserProgress,
// AmyChatSession/Message, Notification, Payment, CourseEnrollment)

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: "student" | "admin";
  avatar_url?: string | null;
  phone?: string | null;
  preferred_language?: "en" | "bn" | null;
}

export interface UserProgress {
  user_id: number;
  xp_total: number;
  xp_today: number;
  streak_days: number;
  lessons_completed: number;
  last_active_date?: string | null;
}

export interface AmyMessage {
  id: number;
  session_id: number;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface AmyChatSession {
  id: number;
  user_id: number;
  title: string;
  subject?: string | null;
  created_at: string;
  messages: AmyMessage[];
}

export interface AppNotification {
  id: number;
  user_id: number;
  title: string;
  body: string;
  type: "streak" | "payment" | "course" | "system";
  read: boolean;
  created_at: string;
}

export type PaymentMethod = "sslcommerz" | "bkash" | "nagad";
export type PaymentStatus = "pending" | "processing" | "verified" | "failed" | "rejected";

export interface Payment {
  id: number;
  user_id: number;
  course_id: number;
  method: PaymentMethod;
  /** amount stored in integer poisha (1 BDT = 100 poisha) */
  amount_poisha: number;
  status: PaymentStatus;
  trx_id?: string | null;      // bKash/Nagad manual transaction id
  trans_id?: string | null;    // SSLCommerz transaction id
  created_at: string;
  verified_at?: string | null;
}

export interface Course {
  id: number;
  title: string;
  description: string;
  category: string;
  price_poisha: number;
  thumbnail_url?: string | null;
  lesson_count: number;
}

export interface CourseEnrollment {
  id: number;
  user_id: number;
  course_id: number;
  payment_id?: number | null;
  enrolled_at: string;
  progress_percent: number;
}

export interface ApiError {
  detail: string;
}
