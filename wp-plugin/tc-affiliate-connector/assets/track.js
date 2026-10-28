(function () {
  if (!window.TCAFF || !window.fetch) return;
  var params = new URLSearchParams(location.search);
  var ref = params.get(TCAFF.var);
  if (!ref) {
    // Pretty links: /some/page/ref/jane/
    var m = location.pathname.match(new RegExp("/" + TCAFF.var + "/([^/]+)/?$"));
    if (m) ref = decodeURIComponent(m[1]);
  }
  var mode = "ref";
  if (!ref) {
    var path = location.pathname.replace(/\/?$/, "/");
    var refHost = "";
    try { refHost = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, "") : ""; } catch (e) {}
    if ((TCAFF.landing || []).indexOf(path) !== -1) mode = "landing";
    else if (refHost && refHost !== location.hostname.replace(/^www\./, "") && (TCAFF.direct || []).indexOf(refHost) !== -1) mode = "direct";
    else return;
  }
  var ppc = params.has("gclid") || params.has("fbclid") || params.has("msclkid") || params.has("gbraid") || params.has("wbraid");
  var body = new URLSearchParams({
    action: "tcaff_track",
    mode: mode,
    ref: ref || "",
    visit: params.get("tc_visit") || "",
    url: location.href,
    referrer: document.referrer || "",
    // ?campaign= is AffiliateWP's campaign tag, which existing affiliate links use
    campaign: params.get("utm_campaign") || params.get("campaign") || params.get("c") || "",
    ppc: ppc ? "1" : "",
  });
  fetch(TCAFF.ajax, { method: "POST", credentials: "same-origin", body: body }).catch(function () {});
})();
