/*
 * @Author: Ella ella.yin@x-humanoid.com
 * @Description: 主插件，提供插件管理、事件绑定、API代理等核心功能
 * @FilePath: /bic-map-plugin/src/examples/expand/MapEditor/ImageEditor/core/Editor.js
 */
import EventEmitter from "events";

import { isRightClick } from "../utils/index";
import ContextMenu from "./ContextMenu.js";

const HOTKEY_MAP = {
  backspace: "Backspace",
  delete: "Delete",
};

class Editor extends EventEmitter {
  canvas = null;
  contextMenu = null;
  pluginMap = {};
  customEvents = [];
  customApis = [];
  hotkeyHandlers = [];

  init(canvas) {
    this.canvas = canvas;
    this._initContextMenu();
    this._bindContextMenu();
  }

  get fabricCanvas() {
    return this.canvas;
  }

  use(plugin, options) {
    if (this._checkPlugin(plugin) && this.canvas) {
      this._saveCustomAttr(plugin);
      const pluginRunTime = new plugin(this.canvas, this, options || {});
      pluginRunTime.pluginName = plugin.pluginName;
      this.pluginMap[plugin.pluginName] = pluginRunTime;
      this._bindingHotkeys(pluginRunTime);
      this._bindingApis(pluginRunTime);
    }
    return this;
  }

  destroy() {
    Object.values(this.pluginMap).forEach((plugin) => {
      if (plugin.destroy && typeof plugin.destroy === "function") {
        plugin.destroy();
      }
    });
    this.contextMenu && this.contextMenu.uninstall();
    this._unbindHotkeys();

    this.canvas = null;
    this.contextMenu = null;
    this.pluginMap = {};
    this.customEvents = [];
    this.customApis = [];
  }

  getPlugin(name) {
    if (this.pluginMap[name]) {
      return this.pluginMap[name];
    }
  }

  _checkPlugin(plugin) {
    const { pluginName, events = [], apis = [] } = plugin;

    if (this.pluginMap[pluginName]) {
      throw new Error(pluginName + "插件重复初始化");
    }
    events.forEach((eventName) => {
      if (this.customEvents.find((info) => info === eventName)) {
        throw new Error(pluginName + "插件中" + eventName + "重复");
      }
    });

    apis.forEach((apiName) => {
      if (this.customApis.find((info) => info === apiName)) {
        throw new Error(pluginName + "插件中" + apiName + "重复");
      }
    });
    return true;
  }

  /**
   * 用浏览器原生键盘事件替代 hotkeys-js，避免引入额外依赖。
   * 仅识别 plugin.hotkeys 中声明的键名（统一小写匹配 e.key）
   */
  _bindingHotkeys(plugin) {
    if (!plugin?.hotkeys?.length) return;

    const handler = (e) => {
      const target = e.target;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) {
        return;
      }
      const key = e.key?.toLowerCase();
      const matched = plugin.hotkeys.find(
        (k) => k.toLowerCase() === key || HOTKEY_MAP[k]?.toLowerCase() === key
      );
      if (matched && plugin.hotkeyEvent) {
        plugin.hotkeyEvent(matched, e);
      }
    };

    window.addEventListener("keydown", handler);
    this.hotkeyHandlers.push(handler);
  }

  _unbindHotkeys() {
    this.hotkeyHandlers.forEach((handler) => {
      window.removeEventListener("keydown", handler);
    });
    this.hotkeyHandlers = [];
  }

  _saveCustomAttr(plugin) {
    const { events = [], apis = [] } = plugin;
    this.customApis = this.customApis.concat(apis);
    this.customEvents = this.customEvents.concat(events);
  }

  _bindingApis(pluginRunTime) {
    const { apis = [] } = pluginRunTime.constructor || {};
    apis.forEach((apiName) => {
      this[apiName] = function () {
        return pluginRunTime[apiName].apply(pluginRunTime, [...arguments]);
      };
    });
  }

  _bindContextMenu() {
    this.canvas &&
      this.canvas.on("mouse:down", (opt) => {
        if (isRightClick(opt)) {
          opt.e.preventDefault();
          let menu = [];
          Object.keys(this.pluginMap).forEach((pluginName) => {
            const pluginRunTime = this.pluginMap[pluginName];
            const pluginMenu =
              pluginRunTime.contextMenu && pluginRunTime.contextMenu();
            if (pluginMenu) {
              menu = menu.concat(pluginMenu);
            }
          });
          this._renderMenu(opt, menu);
        }
      });
  }

  _renderMenu(opt, menu) {
    if (menu.length !== 0 && this.contextMenu) {
      this.contextMenu.hideAll();
      this.contextMenu.setData(menu);
      this.contextMenu.show(opt.e.clientX, opt.e.clientY);
    }
  }

  _initContextMenu() {
    this.contextMenu = new ContextMenu(this.canvas.wrapperEl, []);
    this.contextMenu.install();
  }

  off(eventName, listener) {
    return listener ? super.off(eventName, listener) : this;
  }
}

export default Editor;
