export const runConcurrent = async <T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
) => {
  const queue = [...items];
  const workerCount = Math.max(1, Math.min(concurrency, queue.length));
  const workers = Array.from({ length: workerCount }, async () => {
    while (queue.length > 0) {
      const next = queue.shift();
      if (!next) break;
      await worker(next);
    }
  });
  await Promise.all(workers);
};
