CREATE UNIQUE INDEX "unique_personal_board_per_user" ON "boards" ("created_by") WHERE "type" = 'personal';
