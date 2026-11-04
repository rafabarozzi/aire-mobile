import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export async function nativeDevice() {
  if (Platform.OS === "android")
    await Notifications.setNotificationChannelAsync("aire", {
      name: "Atualizações AIRE",
      importance: Notifications.AndroidImportance.DEFAULT,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    });
  const { granted } = await Notifications.requestPermissionsAsync();
  if (!granted) throw new Error("Sem permissão para notificações");
  const { data } = await Notifications.getDevicePushTokenAsync();
  return { platform: Platform.OS, token: data };
}
