export const TOPICS = [
  "Brunch at the city mall",
  "Picnic in the park with friends",
  "Cozy girls’ sleepover",
  "Study date at the library",
  "Running errands and grocery shopping",
];

export function topicText(topicId) {
  const i = Number(topicId);
  return TOPICS[i] ?? "Unknown topic";
}
