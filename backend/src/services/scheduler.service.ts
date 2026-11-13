import cron, { type ScheduledTask } from 'node-cron';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { needsSyncOnStartup } from '../repositories/sync.repository.js';
import { jellyfinService } from './jellyfin.service.js';
import { qbittorrentService } from './qbittorrent.service.js';
import { watchlistService } from './watchlist.service.js';
import type { JobState, ScheduledJobId } from 'shared/settings.models';
import type { SyncService } from 'shared/sync.models';

interface Job {
    id: ScheduledJobId;
    label: string;
    isConfigured: () => boolean;
    schedule: () => string;
    run: () => Promise<unknown>;
    /** Set for jobs that fill a table which should not start out empty or stale. */
    catchUp?: SyncService;
}

const JOBS: Job[] = [
    {
        id: 'jellyfin',
        label: 'Jellyfin sync',
        isConfigured: () => jellyfinService.isConfigured(),
        schedule: () => config.jellyfin.cronSchedule,
        run: () => jellyfinService.syncLibrary(),
        catchUp: 'jellyfin',
    },
    {
        id: 'qbittorrent',
        label: 'qBittorrent sync',
        isConfigured: () => qbittorrentService.isConfigured(),
        schedule: () => config.qbittorrent.cronSchedule,
        run: () => qbittorrentService.syncTorrents(),
        catchUp: 'qbittorrent',
    },
    {
        id: 'watchlist',
        label: 'Watchlist check',
        isConfigured: () => true,
        schedule: () => config.watchlist.cronSchedule,
        run: () => watchlistService.checkAll(),
    },
];

const running = new Map<ScheduledJobId, { schedule: string; task: ScheduledTask }>();

function errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

function runJob(job: Job, reason: string): void {
    job.run().catch((err: unknown) => logger.error(`${job.label} failed (${reason})`, { error: errorMessage(err) }));
}

function catchUp(job: Job, service: SyncService): void {
    needsSyncOnStartup(service)
        .then((stale) => {
            if (stale) runJob(job, 'catch-up');
        })
        .catch((err: unknown) => logger.error(`${job.label} catch-up check failed`, { error: errorMessage(err) }));
}

function applyJob(job: Job): void {
    const current = running.get(job.id);
    const wanted = job.isConfigured() ? job.schedule() : null;
    if ((current?.schedule ?? null) === wanted) return;

    if (current) {
        void current.task.destroy();
        running.delete(job.id);
    }
    if (!wanted) {
        logger.info(`${job.label} stopped - service is not configured`);
        return;
    }

    running.set(job.id, { schedule: wanted, task: cron.schedule(wanted, () => runJob(job, 'scheduled')) });
    logger.info(`${job.label} scheduled`, { schedule: wanted });
    if (!current && job.catchUp) catchUp(job, job.catchUp);
}

/** Brings the running cron tasks in line with the current config. Safe to call after any config change. */
export function applySchedules(): void {
    JOBS.forEach(applyJob);
}

export function stopSchedules(): void {
    running.forEach(({ task }) => void task.destroy());
    running.clear();
}

export function getJobStates(): JobState[] {
    return JOBS.map((job) => {
        const task = running.get(job.id)?.task;
        return { id: job.id, running: Boolean(task), nextRun: task?.getNextRun()?.toISOString() ?? null };
    });
}

export function isValidCron(expression: string): boolean {
    return expression.split(/\s+/).length === 5 && cron.validate(expression);
}
