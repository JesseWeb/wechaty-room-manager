import { DelayQueueExecutor, DelayQueueExector } from 'rx-queue'
let delayQueueExecutor: DelayQueueExector = new DelayQueueExecutor(5 * 1000)
export const delayQueue = async function (fn: any, name?: string) {
   await delayQueueExecutor.execute(fn, name)
}
