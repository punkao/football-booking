import { pageLang } from "@/lib/server/page";
import { ChallengesClient } from "./ChallengesClient";

export default async function ChallengesPage() {
  return <ChallengesClient lang={await pageLang()} />;
}
