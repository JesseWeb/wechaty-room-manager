import { Contact } from "wechaty";

export interface I_Room {
   id?: string,
   topic?: string,
   hiTemp?: string,
   warnTemp?(count: number, voltCount: number | undefined, contact: Contact): string,
   kickoutTemp?(contact: Contact): string,
   // enableVolt?: boolean,
   voltSymbol?: string[],
   kickoutSymbol?: string[],
   voltCount?: number
   voltOutTemp?(count: number, voltCount: number | undefined, contact: Contact): string
   /**
    * only supported wechaty id(account)
    */
   whiteList?: string[]
}
export interface I_RoomManager {
   rooms: I_Room[],

   /**
    * it has to be wechat id(wechat account)--based on Contact.load()
    *  */
   admins: string[]
}

export interface I_Volt {
   mentionId: string,
   roomId: string,
   count: number,
   volterId: string | undefined | null
}
export interface I_Database {
   volts: I_Volt[]
}