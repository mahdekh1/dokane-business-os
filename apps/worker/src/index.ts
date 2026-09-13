import { Queue } from 'bullmq';

const connection = {
  host: process.env.REDIS_HOST ?? '127.0.0.1',
  port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379,
};

// eslint-disable-next-line no-console
console.log('worker up');

// A queue handle is created now; real consumers (outbox relay, notifications,
// AI jobs) are registered in later phases. Redis may be unavailable during
// scaffolding — log connection errors and keep the process alive.
const queue = new Queue('dokane', { connection });

queue.on('error', (err: Error) => {
  // eslint-disable-next-line no-console
  console.warn('[worker] queue connection error:', err.message);
});

async function shutdown(): Promise<void> {
  await queue.close();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
