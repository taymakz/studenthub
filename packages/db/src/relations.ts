import { relations } from "drizzle-orm"

import { notedCourses, passedCourses } from "./schema/course-user-data"
import { feedback } from "./schema/feedback"
import {
  notificationBatches,
  notificationMessages,
} from "./schema/notifications"
import { professorVotes } from "./schema/professor-votes"
import { uploads } from "./schema/uploads"
import { universityProfiles } from "./schema/university-profiles"
import { users } from "./schema/users"

export const usersRelations = relations(users, ({ one, many }) => ({
  universityProfile: one(universityProfiles, {
    fields: [users.id],
    references: [universityProfiles.userId],
  }),
  notedCourses: many(notedCourses),
  passedCourses: many(passedCourses),
  professorVotes: many(professorVotes),
  uploads: many(uploads),
  feedback: many(feedback),
  notificationMessages: many(notificationMessages),
}))

export const universityProfilesRelations = relations(
  universityProfiles,
  ({ one }) => ({
    user: one(users, {
      fields: [universityProfiles.userId],
      references: [users.id],
    }),
  })
)

export const notificationBatchesRelations = relations(
  notificationBatches,
  ({ many }) => ({
    messages: many(notificationMessages),
  })
)

export const notificationMessagesRelations = relations(
  notificationMessages,
  ({ one }) => ({
    batch: one(notificationBatches, {
      fields: [notificationMessages.batchId],
      references: [notificationBatches.id],
    }),
    user: one(users, {
      fields: [notificationMessages.userId],
      references: [users.id],
    }),
  })
)
