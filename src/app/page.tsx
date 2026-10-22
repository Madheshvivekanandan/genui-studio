/**
 * ROUTING · app/page.tsx — the URL  /.
 *
 * Only wiring: "when someone opens /, show the ChatScreen".
 * Python equivalent:  @app.get("/")  def home(): return render("chat_screen.html")
 */
import { ChatScreen } from "@/components/ChatScreen";

export default function Page() {
  return <ChatScreen />;
}
