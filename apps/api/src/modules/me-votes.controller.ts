import { zValidator } from "@hono/zod-validator"
import { professorVotes } from "@workspace/db/schema"
import { and, eq } from "drizzle-orm"
import { Hono } from "hono"
import { z } from "zod"

import { db } from "@/lib/db"
import { badRequest, notFound, ok } from "@/lib/http/common"
import { getProfessors } from "@/lib/registry"
import type { AppEnv } from "@/middleware/auth"
import { requireUser, withUser } from "@/middleware/auth"

/** Own professor votes (mini app). Aggregate lives in /app registry routes. */

const scoreSchema = z.object({
  examDifficulty: z.number().int().min(1).max(5),
  teachingQuality: z.number().int().min(1).max(5),
  mastery: z.number().int().min(1).max(5),
  leniency: z.number().int().min(1).max(5),
  questionSimilarity: z.number().int().min(1).max(5),
})

const voteSchema = scoreSchema.extend({
  universitySlug: z.string().min(1).max(128),
  majorSlug: z.string().min(1).max(128),
  professorSlug: z.string().min(1).max(128),
  providesSampleQuestions: z.boolean().optional(),
  providesNotes: z.boolean().optional(),
  mandatoryAttendance: z.boolean().optional(),
  comment: z.string().max(500).optional(),
})

export const meVoteRoutes = new Hono<AppEnv>()
  .use("*", withUser, requireUser)
  .get("/me/vote/:professorSlug", async (c) => {
    const user = c.get("user")!
    const slug = decodeURIComponent(c.req.param("professorSlug"))
    const [vote] = await db
      .select()
      .from(professorVotes)
      .where(
        and(
          eq(professorVotes.userId, user.id),
          eq(professorVotes.professorSlug, slug)
        )
      )
      .limit(1)
    if (!vote) return notFound(c, "رأیی ثبت نکرده‌اید")
    return ok(c, { vote })
  })
  .put("/me/vote", zValidator("json", voteSchema), async (c) => {
    const user = c.get("user")!
    const body = c.req.valid("json")

    const known = await getProfessors(body.universitySlug, body.majorSlug)
    if (!known.some((p) => p.slug === body.professorSlug)) {
      return badRequest(c, "این استاد در رجیستری این رشته ثبت نشده")
    }

    // One vote per user per professor - upsert keeps that invariant.
    const {
      universitySlug,
      majorSlug,
      professorSlug,
      comment,
      providesSampleQuestions,
      providesNotes,
      mandatoryAttendance,
      ...scores
    } = body

    const [vote] = await db
      .insert(professorVotes)
      .values({
        userId: user.id,
        universitySlug,
        majorSlug,
        professorSlug,
        ...scores,
        providesSampleQuestions: providesSampleQuestions ?? false,
        providesNotes: providesNotes ?? false,
        mandatoryAttendance: mandatoryAttendance ?? false,
        ...(comment !== undefined ? { comment } : {}),
      })
      .onConflictDoUpdate({
        target: [professorVotes.userId, professorVotes.professorSlug],
        set: {
          universitySlug,
          majorSlug,
          ...scores,
          providesSampleQuestions: providesSampleQuestions ?? false,
          providesNotes: providesNotes ?? false,
          mandatoryAttendance: mandatoryAttendance ?? false,
          comment: comment ?? null,
          updatedAt: new Date(),
        },
      })
      .returning()

    return ok(c, { vote }, "رأی شما ذخیره شد")
  })
  .delete("/me/vote/:professorSlug", async (c) => {
    const user = c.get("user")!
    const slug = decodeURIComponent(c.req.param("professorSlug"))
    await db
      .delete(professorVotes)
      .where(
        and(
          eq(professorVotes.userId, user.id),
          eq(professorVotes.professorSlug, slug)
        )
      )
    return ok(c, null, "رأی حذف شد")
  })
