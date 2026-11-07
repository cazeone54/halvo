import { describe, expect, it } from "vitest";
import { detectInAppBrowser, openInChromeUrl } from "./in-app-browser";

// Real user agents, as these apps send them.
const UA = {
  instagramIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 339.0.3.12.91 (iPhone14,5; iOS 17_5; en_US; en; scale=3.00; 1170x2532; 618343563)",
  instagramAndroid:
    "Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/AP2A.240805.005; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/127.0.6533.103 Mobile Safari/537.36 Instagram 343.0.0.33.101 Android (34/14; 420dpi; 1080x2205; Google/google; Pixel 7; panther; panther; en_US; 627400398)",
  facebookIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/462.0.0.36.106;FBBV/601203935;FBDV/iPhone15,3;FBMD/iPhone;FBSN/iOS;FBSV/17.4;FBSS/3;FBID/phone;FBLC/en_US;FBOP/5]",
  facebookAndroid:
    "Mozilla/5.0 (Linux; Android 13; SM-S911B Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.71 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/473.0.0.40.109;]",
  messengerIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/458.0.0.42.110;FBBV/598337411;FBDV/iPhone14,7;FBMD/iPhone;FBSN/iOS;FBSV/17.4]",
  tiktok:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 musical_ly_35.1.0 JsSdk/2.0 NetType/WIFI Channel/App Store ByteLocale/en Region/US",
  threads:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Barcelona 344.0.0.17.88 (iPhone15,2; iOS 17_5; en_US; en; scale=3.00; 1179x2556; 628500227)",
  safari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  chromeAndroid:
    "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36",
  chromeDesktop:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
};

describe("detectInAppBrowser", () => {
  it("names the app an ad visitor is stuck inside", () => {
    expect(detectInAppBrowser(UA.instagramIos)).toEqual({ app: "Instagram", android: false, ios: true });
    expect(detectInAppBrowser(UA.instagramAndroid)).toEqual({ app: "Instagram", android: true, ios: false });
    expect(detectInAppBrowser(UA.facebookIos)?.app).toBe("Facebook");
    expect(detectInAppBrowser(UA.facebookAndroid)?.app).toBe("Facebook");
    expect(detectInAppBrowser(UA.messengerIos)?.app).toBe("Messenger");
    expect(detectInAppBrowser(UA.tiktok)?.app).toBe("TikTok");
    expect(detectInAppBrowser(UA.threads)?.app).toBe("Threads");
  });

  it("leaves real browsers alone", () => {
    for (const ua of [UA.safari, UA.chromeAndroid, UA.chromeDesktop, "", null, undefined]) {
      expect(detectInAppBrowser(ua)).toBeNull();
    }
  });
});

describe("openInChromeUrl", () => {
  it("asks Android to open the same page in Chrome, falling back to the page itself", () => {
    const url = openInChromeUrl("https://halvo.io/login?utm_source=ig");
    expect(url).toBe(
      "intent://halvo.io/login?utm_source=ig#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=https%3A%2F%2Fhalvo.io%2Flogin%3Futm_source%3Dig;end",
    );
  });

  it("refuses anything that isn't an https page", () => {
    expect(openInChromeUrl("javascript:alert(1)")).toBeNull();
    expect(openInChromeUrl("http://halvo.io/login")).toBeNull();
    expect(openInChromeUrl("not a url")).toBeNull();
  });
});
