import { loadConfig } from "../src/config";
import { createLogger } from "../src/util/log";

const log = createLogger("simulate-update");

function makeFakeStartUpdate(
  chatId: number,
  firstName: string,
  lastName: string,
  username: string,
) {
  return {
    update_id: Math.floor(Math.random() * 1000000),
    message: {
      message_id: 1,
      from: {
        id: chatId,
        is_bot: false,
        first_name: firstName,
        last_name: lastName,
        username,
        language_code: "it",
      },
      chat: {
        id: chatId,
        first_name: firstName,
        last_name: lastName,
        username,
        type: "private",
      },
      date: Math.floor(Date.now() / 1000),
      text: "/start",
      entities: [{ offset: 0, length: 6, type: "bot_command" }],
    },
  };
}

async function main(): Promise<void> {
  const config = loadConfig(process.env);
  const chatId = process.env.TEST_CHAT_ID
    ? Number(process.env.TEST_CHAT_ID)
    : 123456789;

  const body = JSON.stringify(
    makeFakeStartUpdate(chatId, "Test", "User", "testuser"),
  );

  log.info({ chatId }, "sending fake /start update");

  const res = await fetch("http://localhost:8787/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Telegram-Bot-Api-Secret-Token": config.WEBHOOK_SECRET,
    },
    body,
  });

  log.info({ status: res.status, body: await res.text() }, "response received");
}

main().catch((err) => {
  log.error({ err: String(err) }, "simulate-update failed");
  process.exit(1);
});
