import "./contextMenu.scss";
class ContextMenu {
  constructor(container, items) {
    this.container = container;
    this.dom = null;
    this.shown = false;
    this.root = true;
    this.parent = null;
    this.submenus = [];
    this.items = items;

    this._onclick = (e) => {
      if (
        this.dom &&
        e.target != this.dom &&
        e.target.parentElement != this.dom &&
        !e.target.classList.contains("item") &&
        !e.target.parentElement.classList.contains("item")
      ) {
        this.hideAll();
      }
    };

    this._oncontextmenu = (e) => {
      e.preventDefault();
      if (
        e.target != this.dom &&
        e.target.parentElement != this.dom &&
        !e.target.classList.contains("item") &&
        !e.target.parentElement.classList.contains("item")
      ) {
        this.hideAll();
        this.show(e.clientX, e.clientY);
      }
    };

    this._onblur = () => {
      this.hideAll();
    };
  }

  getMenuDom() {
    const menu = document.createElement("div");
    menu.classList.add("context");

    const items = this.items.concat([
      {
        text: "取消",
        hotkey: "",
        disabled: false,
        onclick: () => this.hide(),
      },
    ]);

    for (const item of items) {
      menu.appendChild(this.itemToDomEl(item));
    }

    return menu;
  }

  itemToDomEl(data) {
    const item = document.createElement("div");

    if (data === null) {
      item.classList = "separator";
      return item;
    }

    item.classList.add("item");

    const label = document.createElement("span");
    label.classList = "label";
    label.innerText = data.hasOwnProperty("text")
      ? data["text"].toString()
      : "";
    item.appendChild(label);

    if (data.hasOwnProperty("disabled") && data["disabled"]) {
      item.classList.add("disabled");
    } else {
      item.classList.add("enabled");
    }

    const hotkey = document.createElement("span");
    hotkey.classList = "hotkey";
    hotkey.innerText = data.hasOwnProperty("hotkey")
      ? data["hotkey"].toString()
      : "";
    item.appendChild(hotkey);

    item.addEventListener("click", () => {
      this.hideSubMenus();

      if (item.classList.contains("disabled")) return;

      if (
        data.hasOwnProperty("onclick") &&
        typeof data["onclick"] === "function"
      ) {
        const event = {
          handled: false,
          item: item,
          label: label,
          hotkey: hotkey,
          items: this.items,
          data: data,
        };

        data["onclick"](event);

        if (!event.handled) {
          this.hide();
        }
      } else {
        this.hide();
      }
    });

    item.addEventListener("mousemove", () => {
      this.hideSubMenus();
    });

    return item;
  }

  hideAll() {
    if (this.root && !this.parent) {
      if (this.shown) {
        this.hideSubMenus();

        this.shown = false;
        this.container.removeChild(this.dom);

        if (this.parent && this.parent.shown) {
          this.parent.hide();
        }
      }

      return;
    }

    this.parent.hide();
  }

  hide() {
    if (this.dom && this.shown) {
      this.shown = false;
      this.hideSubMenus();
      this.container.removeChild(this.dom);

      if (this.parent && this.parent.shown) {
        this.parent.hide();
      }
    }
  }

  hideSubMenus() {
    for (const menu of this.submenus) {
      if (menu.shown) {
        menu.shown = false;
        menu.container.removeChild(menu.dom);
      }
      menu.hideSubMenus();
    }
  }

  show(x, y) {
    this.dom = this.getMenuDom();

    this.dom.style.left = `${x}px`;
    this.dom.style.top = `${y}px`;

    this.shown = true;
    this.container.appendChild(this.dom);
  }

  install() {
    this.container.addEventListener("contextmenu", this._oncontextmenu);
    this.container.addEventListener("click", this._onclick);
    window.addEventListener("blur", this._onblur);
  }

  setData(data) {
    this.items = data;
  }

  uninstall() {
    this.dom = null;
    this.container.removeEventListener("contextmenu", this._oncontextmenu);
    this.container.removeEventListener("click", this._onclick);
    window.removeEventListener("blur", this._onblur);
  }
}

export default ContextMenu;
