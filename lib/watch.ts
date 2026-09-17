import "server-only";
import { sendAlertEmail } from "./email";
import { getRepo } from "./repo";
import { executeScrapeJob, requestScrape } from "./scrape/pipeline";

export interface WatchRunReport {
  watches: number;
  scraped: number;
  alerts: number;
  rescored: number;
  errors: string[];
}

/** Cron task: rescore recent posts, re-scrape every watched topic, and email posts that cross the threshold. */
export async function refreshWatchedTopics(): Promise<WatchRunReport> {
  const repo = await getRepo();
  const report: WatchRunReport = { watches: 0, scraped: 0, alerts: 0, rescored: 0, errors: [] };

  report.rescored = await repo.posts.rescoreSince(new Date(Date.now() - 30 * 24 * 3_600_000));

  const watches = await repo.watches.all();
  report.watches = watches.length;

  for (const watch of watches) {
    try {
      const result = await requestScrape({
        topic: watch.topic,
        platforms: watch.platforms,
        userId: watch.userId,
        rateKey: "cron",
        force: false,
      });
      const posts = result.status === "started" ? await executeScrapeJob(result.job.id) : [];
      if (result.status === "started") report.scraped++;

      // Also consider stored posts, so a watch created after a scrape still gets alerted.
      const stored = await repo.posts.search({
        topic: watch.topic,
        platforms: watch.platforms,
        sort: ["trending"],
        from: new Date(Date.now() - 7 * 24 * 3_600_000),
        page: 1,
        limit: 50,
      });
      const byId = new Map([...posts, ...stored.items].map((p) => [p.id, p]));
      const hot = [...byId.values()].filter((p) => p.trendingScore >= watch.thresholdScore);

      const fresh = [];
      for (const post of hot) if (await repo.watches.recordAlert(watch.id, post.id)) fresh.push(post);
      if (fresh.length && !watch.userEmail) {
        console.info(`[virallens] ${fresh.length} alert(s) for "${watch.topic}" not emailed: the user has no email address`);
      } else if (fresh.length && watch.userEmail) {
        await sendAlertEmail(watch.userEmail, watch.topic, fresh.sort((a, b) => b.trendingScore - a.trendingScore).slice(0, 10));
      }
      report.alerts += fresh.length;
      await repo.watches.markChecked(watch.id, new Date());
    } catch (error) {
      report.errors.push(`${watch.topic}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return report;
}
