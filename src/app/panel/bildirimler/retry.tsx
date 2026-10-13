"use client";

import { ActionButton } from "@/components/action-form";
import { retryNotificationAction } from "@/app/panel/actions";

export function RetryButton({ notificationId }: { notificationId?: number }) {
  return (
    <ActionButton
      action={retryNotificationAction}
      label={notificationId ? "Yeniden gönder" : "Hatalıları yeniden gönder"}
      tone={notificationId ? "secondary" : "primary"}
      fields={notificationId ? { notificationId } : {}}
    />
  );
}
