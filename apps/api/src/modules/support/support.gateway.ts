import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { JwtService } from "@nestjs/jwt";
import { Server, Socket } from "socket.io";
import { ADMIN_COOKIE, parseCookies } from "../../common/cookie.util";

/**
 * Live delivery for the patient ↔ admin support chat.
 * Admins join the shared `admins` room; each patient joins `user:<id>`.
 * REST handlers persist the message (and upload attachments), then call the
 * broadcast helpers here so connected clients update in real time.
 */
@WebSocketGateway({
  cors: { origin: true, credentials: true },
  namespace: "support",
})
export class SupportGateway implements OnGatewayConnection {
  @WebSocketServer() server: Server;

  constructor(private readonly jwt: JwtService) {}

  handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth?.token as string) ||
        (client.handshake.query?.token as string) ||
        // Admin browser authenticates the socket with its httpOnly session cookie.
        parseCookies(client.handshake.headers?.cookie)[ADMIN_COOKIE] ||
        "";
      const payload = this.jwt.verify(token, {
        secret: process.env.JWT_SECRET,
      }) as {
        sub: string;
        role: string;
      };
      if (payload.role === "admin") client.join("admins");
      else if (payload.role === "user") client.join(`user:${payload.sub}`);
      else client.disconnect();
    } catch {
      client.disconnect();
    }
  }

  /** Deliver a new message to admins + the owning patient. */
  broadcastMessage(message: unknown, userId: string) {
    if (!this.server) return;
    this.server.to("admins").emit("support:newMessage", { message, userId });
    this.server
      .to(`user:${userId}`)
      .emit("support:newMessage", { message, userId });
  }

  /** Notify both sides that a thread was read (to clear unread indicators live). */
  broadcastRead(userId: string, by: "USER" | "ADMIN") {
    if (!this.server) return;
    this.server.to("admins").emit("support:read", { userId, by });
    this.server.to(`user:${userId}`).emit("support:read", { userId, by });
  }

  /**
   * "There's a New Patient Booking" — pops on every logged-in admin (they all
   * sit in the `admins` room on this namespace already, so no new socket).
   */
  broadcastNewBooking(booking: {
    id: string;
    patientName: string;
    doctorName: string;
    date: string;
    time: string;
    amount: number;
    status: string;
  }) {
    if (!this.server) return;
    this.server.to("admins").emit("booking:new", booking);
  }
}
