export const COMMENT_REACTIONS = [
  'thumbs_up',
  'thumbs_down', // legacy support for existing data
  'check',
  'hundred',
  'plus_one',
  'handshake',
  'heart',
  'celebrate',
  'fire',
  'clap',
  'star',
  'thanks',
  'rocket',
  'coffee',
  'sparkles',
  'eyes',
  'fixing',
  'notes',
  'idea',
  'question',
] as const;

export type CommentReactionType = (typeof COMMENT_REACTIONS)[number];
