import type { BedStatus, GroupStatus } from "../../domain/enums/status";
import { bedStatusLabel, groupStatusLabel } from "../../domain/enums/status";

interface Props {
  status: BedStatus | GroupStatus;
}

export default function StatusPill({ status }: Props) {
  const label = status === "FALLOW" || status === "ACTIVE" ? bedStatusLabel[status as BedStatus] ?? groupStatusLabel[status as GroupStatus] : status;
  return <span className={`status-pill ${status.toLowerCase()}`}>{label}</span>;
}
