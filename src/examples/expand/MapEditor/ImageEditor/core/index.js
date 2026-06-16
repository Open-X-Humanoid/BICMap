/*
 * @Author: Ella ella.yin@x-humanoid.com
 * @Date: 2025-07-16 10:58:18
 * @LastEditors: Ella ella.yin@x-humanoid.com
 * @LastEditTime: 2025-07-22 20:19:50
 * @FilePath: /bic-robobiz-admin/src/components/ImageEditor/core/index.js
 * @Description: 插件导出入口
 */
import Editor from './Editor';
import DrawPlugin from './plugins/DrawPlugin';
import WorkspacePlugin from './plugins/WorkspacePlugin';
import DragPlugin from './plugins/DragPlugin';
import FreeDrawPlugin from './plugins/FreeDrawPlugin';
import StraightLinePlugin from './plugins/StraightLinePlugin';
import DeletePlugin from './plugins/DeletePlugin';
import ExportPlugin from './plugins/ExportPlugin';
import ControlsPlugin from './plugins/ControlsPlugin';
import HistoryPlugin from './plugins/HistoryPlugin';

export default Editor;

export {
  DrawPlugin,
  WorkspacePlugin,
  HistoryPlugin,
  DragPlugin,
  FreeDrawPlugin,
  StraightLinePlugin,
  DeletePlugin,
  ExportPlugin,
  ControlsPlugin,
};