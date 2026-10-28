(function () {
  if (!window.TCAFF || !window.fetch) return;
  var params = new URLSearchParams(location.search);
  var ref = params.get(TCAFF.var);
  if (!ref) {
    // Pretty links: /some/page/ref/jane/
    var m = location.pathname.match(new RegExp("/" + TCAFF.var + "/([^/]+)/?$"));
    if (m) ref = decodeURIComponent(m[1]);
  }
  if (!ref) return;
  var body = new URLSearchParams({
    action: "tcaff_track",
    ref: ref,
    visit: params.get("tc_visit") || "",
    url: location.href,
    referrer: document.referrer || "",
    campaign: params.get("utm_campaign") || params.get("c") || "",
  });
  fetch(TCAFF.ajax, { method: "POST", credentials: "same-origin", body: body }).catch(function () {});
})();
