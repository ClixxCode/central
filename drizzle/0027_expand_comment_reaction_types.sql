ALTER TABLE "comment_reactions" DROP CONSTRAINT IF EXISTS "comment_reactions_reaction_check";
--> statement-breakpoint
ALTER TABLE "comment_reactions"
ADD CONSTRAINT "comment_reactions_reaction_check" CHECK (
  "reaction" IN (
    'thumbs_up',
    'thumbs_down',
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
    'question'
  )
);
