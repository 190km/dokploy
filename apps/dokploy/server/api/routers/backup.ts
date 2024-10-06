import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import {
	apiCreateBackup,
	apiFindOneBackup,
	apiRemoveBackup,
	apiUpdateBackup,
} from "@/server/db/schema";
import { removeJob, schedule } from "@/server/utils/backup";
import {
	createBackup,
	findBackupById,
	removeBackupById,
	updateBackupById,
	runMariadbBackup,
	runMongoBackup,
	runMySqlBackup,
	runPostgresBackup,
	removeScheduleBackup,
	scheduleBackup,
	findMariadbByBackupId,
	findMongoByBackupId,
	findMySqlByBackupId,
	findPostgresByBackupId,
	IS_CLOUD,
} from "@dokploy/builders";

import { TRPCError } from "@trpc/server";

export const backupRouter = createTRPCRouter({
	create: protectedProcedure
		.input(apiCreateBackup)
		.mutation(async ({ input }) => {
			try {
				const newBackup = await createBackup(input);

				const backup = await findBackupById(newBackup.backupId);

				if (IS_CLOUD && backup.enabled) {
					await schedule({
						cronSchedule: backup.schedule,
						backupId: backup.backupId,
						type: "backup",
					});
				} else {
					if (backup.enabled) {
						scheduleBackup(backup);
					}
				}
			} catch (error) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Error to create the Backup",
					cause: error,
				});
			}
		}),
	one: protectedProcedure.input(apiFindOneBackup).query(async ({ input }) => {
		const backup = await findBackupById(input.backupId);
		return backup;
	}),
	update: protectedProcedure
		.input(apiUpdateBackup)
		.mutation(async ({ input }) => {
			try {
				await updateBackupById(input.backupId, input);
				const backup = await findBackupById(input.backupId);

				if (IS_CLOUD && backup.enabled) {
					await schedule({
						cronSchedule: backup.schedule,
						backupId: backup.backupId,
						type: "backup",
					});
				} else {
					if (backup.enabled) {
						removeScheduleBackup(input.backupId);
						scheduleBackup(backup);
					} else {
						removeScheduleBackup(input.backupId);
					}
				}
			} catch (error) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Error to update this Backup",
				});
			}
		}),
	remove: protectedProcedure
		.input(apiRemoveBackup)
		.mutation(async ({ input }) => {
			try {
				const value = await removeBackupById(input.backupId);
				if (IS_CLOUD && value) {
					removeJob({
						backupId: input.backupId,
						cronSchedule: value.schedule,
						type: "backup",
					});
				} else {
					removeScheduleBackup(input.backupId);
				}
				return value;
			} catch (error) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Error to delete this Backup",
					cause: error,
				});
			}
		}),
	manualBackupPostgres: protectedProcedure
		.input(apiFindOneBackup)
		.mutation(async ({ input }) => {
			try {
				const backup = await findBackupById(input.backupId);
				const postgres = await findPostgresByBackupId(backup.backupId);
				await runPostgresBackup(postgres, backup);
				return true;
			} catch (error) {
				console.log(error);
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Error to run manual postgres backup ",
					cause: error,
				});
			}
		}),

	manualBackupMySql: protectedProcedure
		.input(apiFindOneBackup)
		.mutation(async ({ input }) => {
			try {
				const backup = await findBackupById(input.backupId);
				const mysql = await findMySqlByBackupId(backup.backupId);
				await runMySqlBackup(mysql, backup);
				return true;
			} catch (error) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Error to run manual mysql backup ",
					cause: error,
				});
			}
		}),
	manualBackupMariadb: protectedProcedure
		.input(apiFindOneBackup)
		.mutation(async ({ input }) => {
			try {
				const backup = await findBackupById(input.backupId);
				const mariadb = await findMariadbByBackupId(backup.backupId);
				await runMariadbBackup(mariadb, backup);
				return true;
			} catch (error) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Error to run manual mariadb backup ",
					cause: error,
				});
			}
		}),
	manualBackupMongo: protectedProcedure
		.input(apiFindOneBackup)
		.mutation(async ({ input }) => {
			try {
				const backup = await findBackupById(input.backupId);
				const mongo = await findMongoByBackupId(backup.backupId);
				await runMongoBackup(mongo, backup);
				return true;
			} catch (error) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Error to run manual mongo backup ",
					cause: error,
				});
			}
		}),
});
