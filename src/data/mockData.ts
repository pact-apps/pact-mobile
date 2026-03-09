import { ChallengeSummary } from "../components/challenges/ChallengeCard";

export const mockChallenges: ChallengeSummary[] = [
  {
    id: "ch-1",
    title: "Run 20KM This Week",
    pool: "120 USDC",
    participants: "6 / 8",
    timeLabel: "Time Left",
    timeRemaining: "2d 13h",
    status: "Active",
  },
  {
    id: "ch-2",
    title: "No Sugar 14 Days",
    pool: "80 USDC",
    participants: "4 / 6",
    timeLabel: "Submission",
    timeRemaining: "18h",
    status: "Submission",
  },
  {
    id: "ch-3",
    title: "Daily Coding 60m",
    pool: "160 USDC",
    participants: "8 / 8",
    timeLabel: "State",
    timeRemaining: "Completed",
    status: "Completed",
  },
];

export const mockParticipants = [
  { username: "alexa.fit", submitted: true, result: "Success" as const },
  { username: "milo.run", submitted: true, result: "Fail" as const },
  { username: "nova.lift", submitted: false, result: "Pending" as const },
  { username: "kai.trains", submitted: true, result: "Success" as const },
];
