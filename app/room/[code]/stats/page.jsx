import RoomStatsClient from "./room-stats-client";

export default async function RoomStatsPage({ params }) {
  const { code } = await params;
  return <RoomStatsClient code={code} />;
}
