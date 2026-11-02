import ObsOverlay from "./obs-overlay";

export default async function OverlayPage({ params }) {
  const { code } = await params;
  return <ObsOverlay code={code} />;
}
