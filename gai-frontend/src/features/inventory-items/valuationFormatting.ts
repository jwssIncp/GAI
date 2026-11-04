import { formatDate } from "@/utils/format";
/** SQL DATE is a civil date; converting midnight UTC to local time changes its day. */
export function formatValuationDate(value: string | null | undefined): string {
  const civil = value?.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
  return civil ? `${civil[3]}/${civil[2]}/${civil[1]}` : formatDate(value);
}
