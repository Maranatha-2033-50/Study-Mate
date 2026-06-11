// ─── Domain Types ─────────────────────────────────────────────────────────────

export type UserRole = 'student' | 'tutor';

export interface Profile {
  id: string;
  role: UserRole;
  name: string;
  created_at: string;
}

export interface TutorStudent {
  id: string;
  tutor_id: string;
  student_id: string;
}

export type CategoryType = 'CERT' | 'LANG' | 'SCHOOL';

export interface LearningCategory {
  id: string;
  type: CategoryType;
  title: string;
  created_at: string;
}

export interface LearningChapter {
  id: string;
  category_id: string;
  level_1: string;
  level_2: string;
}

export type QuestionType = 'MULTIPLE_4' | 'MULTIPLE_5' | 'SHORT_ANSWER';
export type Difficulty = '상' | '중' | '하';

export interface QuestionOptions {
  A: string;
  B: string;
  C: string;
  D: string;
  E?: string;
}

export interface UniversalQuestion {
  id: string;
  chapter_id: string;
  question_type: QuestionType;
  question_text: string;
  options: QuestionOptions | null;
  answer: string;
  difficulty: Difficulty;
  created_at: string;
  // joined
  learning_chapters?: LearningChapter;
}

export type SessionType = 'DIAGNOSTIC' | 'INFINITE_TRAINING' | 'SUBJECTIVE';
export type SessionStatus = 'IN_PROGRESS' | 'COMPLETED';

export type LimitType = 'COUNT' | 'TIME';

export interface SessionConfig {
  limit_type: LimitType;
  limit_value: number;
  chapter_ids?: string[];        // for INFINITE_TRAINING
  difficulty?: Difficulty[];
}

export interface StudySession {
  id: string;
  user_id: string;
  category_id: string;
  session_type: SessionType;
  config: SessionConfig;
  status: SessionStatus;
  created_at: string;
}

export interface UserAttempt {
  id: string;
  session_id: string;
  question_id: string;
  user_answer: string;
  is_correct: boolean;
  elapsed_time: number;
  created_at: string;
}

// ─── Analytics / View Types ───────────────────────────────────────────────────

export interface WeaknessStat {
  user_id: string;
  category_id: string;
  chapter_id: string;
  level_1: string;
  level_2: string;
  total_attempts: number;
  correct_count: number;
  accuracy_rate: number;       // 0–100
  avg_elapsed_seconds: number;
}

export interface CategoryAccuracy {
  level_1: string;
  accuracy_rate: number;
  total_attempts: number;
}

// ─── AI Planner ───────────────────────────────────────────────────────────────

export interface PlannerInput {
  category_title: string;
  weak_chapters: { level_1: string; level_2: string; accuracy_rate: number }[];
  exam_date: string;            // ISO date string
  available_hours: number;      // hours per day
}

export interface DailyPlan {
  date: string;
  sessions: { time_slot: string; chapter: string; task: string; duration_min: number }[];
}

export interface AIStudyPlan {
  summary: string;
  weekly_goal: string;
  daily_plans: DailyPlan[];
  tips: string[];
}

// ─── UI / Component State ─────────────────────────────────────────────────────

export interface SessionDraft {
  sessionId: string;
  answers: Record<string, string>;      // question_id → user answer
  elapsedTimes: Record<string, number>; // question_id → accumulated seconds
  currentIdx: number;
}

export interface StudentWithStats {
  profile: Profile;
  weakness_stats: WeaknessStat[];
  recent_sessions: StudySession[];
}

// ─── Subjective Grading (IELTS/DELF Writing·Speaking) ──────────────────────────

export type SubjectiveExamType = 'IELTS' | 'DELF';

export interface SubjectiveCorrection {
  original:  string;   // 학생이 쓴 틀린 문장
  corrected: string;   // 교정된 문장
  rationale: string;   // 한글 교정 이유
}

export interface SubjectiveCriterion {
  score:   number;     // 항목 점수 (IELTS: band 0–9, DELF: 0–25)
  comment: string;     // 항목별 한 줄 평
}

export interface SubjectiveFeedback {
  overall_score:    number;                            // 최종 예상 Band Score / 등급
  criteria:         Record<string, SubjectiveCriterion>; // 영역별 점수 + 한 줄 평
  corrections:      SubjectiveCorrection[];            // 문장별 첨삭
  general_feedback: string;                            // [학생용] 실전 오답노트 총평 (한국어)
  tutor_guide:      string;                            // [강사용] AI 코칭 백서 (한국어 마크다운)
}

export interface SubjectiveGradeRequest {
  exam_type:     SubjectiveExamType;
  question_text: string;
  answer:        string;        // essay 텍스트 또는 speaking 발화 전사
  user_id?:      string;
  session_id?:   string;        // 있으면 user_attempts에 결과 저장
  question_id?:  string;
}
