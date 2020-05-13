import { Message } from "wechaty";

let commands: RegExp[] = [/#发言\-(\S*)\-(\S*)/,]
export function matchCommand(msg: Message) {
   let text = msg.text()

   commands.forEach((reg) => {
      if (reg.test(text)) {
         text.match(reg)
      }
   })

}