function toggleSidebar() {
  const isMobile = window.matchMedia("(max-width: 47.999rem)").matches;
  if (isMobile) {
    toggleNav();
  } else {
    document.body.classList.toggle("sidebar-hidden");
  }

  updateSidebarButton();
}

function updateSidebarButton() {
  const button = document.querySelector(".topbar-button-sidebar button");
  if (!button) return;

  const isMobile = window.matchMedia("(max-width: 47.999rem)").matches;
  const isExpanded = isMobile
    ? document.body.classList.contains("sidebar-flyout")
    : !document.body.classList.contains("sidebar-hidden");
  button.setAttribute("aria-controls", "R-sidebar");
  button.setAttribute("aria-expanded", String(isExpanded));
}

document.addEventListener("DOMContentLoaded", () => {
  updateSidebarButton();
  document.addEventListener(
    "keydown",
    event => {
      if (
        window.matchMedia("(max-width: 47.999rem)").matches ||
        !event.ctrlKey ||
        !event.altKey ||
        event.shiftKey ||
        event.metaKey ||
        event.key.toLowerCase() !== "n"
      ) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      toggleSidebar();
    },
    true,
  );
  new MutationObserver(updateSidebarButton).observe(document.body, {
    attributes: true,
    attributeFilter: ["class"],
  });
  window.matchMedia("(max-width: 47.999rem)").addEventListener("change", updateSidebarButton);

  document.querySelectorAll("#TableOfContents, .TableOfContents").forEach((toc, tocIndex) => {
    toc.querySelectorAll("li").forEach((item, itemIndex) => {
      const link = item.querySelector(":scope > a");
      const children = item.querySelector(":scope > ul");
      if (!link || !children) return;

      const childrenId = children.id || `toc-${tocIndex + 1}-${itemIndex + 1}`;
      children.id = childrenId;
      children.hidden = true;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "toc-collapse-toggle";
      button.setAttribute("aria-controls", childrenId);
      button.setAttribute("aria-expanded", "false");
      button.setAttribute("aria-label", `Expand ${link.textContent.trim()}`);
      button.textContent = "+";
      button.addEventListener("click", () => {
        const expanded = button.getAttribute("aria-expanded") !== "true";
        children.hidden = !expanded;
        button.setAttribute("aria-expanded", String(expanded));
        button.setAttribute("aria-label", `${expanded ? "Collapse" : "Expand"} ${link.textContent.trim()}`);
        button.textContent = expanded ? "−" : "+";
      });

      link.before(button);
    });
  });
});
