import type { DragonDawwaAnalysis } from './hadith.ts';

export interface UserAccount {
  user_id: string;
  email: string;
  display_name: string;
  profile_pic: string;
  preferred_language: 'en' | 'ta' | 'si';
  created_at: string;
  badge?: string;
}

export interface WallComment {
  comment_id: string;
  post_id: string;
  author_id: string;
  author_name: string;
  author_avatar: string;
  author_role?: string;
  text: string;
  language?: 'en' | 'ta' | 'si';
  created_at: string;
  likes: number;
}

export interface WallPost {
  post_id: string;
  search_id: string;
  author_id: string;
  author_name: string;
  author_email: string;
  author_avatar: string;
  author_role: string;
  query_text: string;
  canonical_arabic: string;
  isnad_preview?: string;
  purity_score: number;
  final_status: string;
  consensus_summary: string;
  is_public: boolean;
  likes_count: number;
  comments_count: number;
  user_has_liked?: boolean;
  comments: WallComment[];
  full_analysis_payload: DragonDawwaAnalysis;
  created_at: string;
  tags: string[];
}
