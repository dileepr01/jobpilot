import { runDailyJobs } from '@/lib/pipeline'

runDailyJobs()
  .then((metrics) => console.log('JobPilot daily run completed', metrics))
  .catch((error) => {
    console.error('JobPilot daily run failed', error)
    process.exitCode = 1
  })
