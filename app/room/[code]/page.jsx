import RoomClient from "./room-client";

export default async function RoomPage({ params }) {
  const { code } = await params;
  return <RoomClient code={code} />;
}
