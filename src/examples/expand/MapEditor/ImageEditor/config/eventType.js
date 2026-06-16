/*
 * @Author: Ella ella.yin@x-humanoid.com
 * @Date: 2025-07-16 14:57:18
 * @LastEditors: Ella ella.yin@x-humanoid.com
 * @LastEditTime: 2025-07-28 15:48:49
 * @FilePath: /bic-robobiz-admin/src/components/ImageEditor/config/eventType.js
 * @Description: 画布事件类型
 */
// 选择模式
export const SelectMode = {
  EMPTY: "",
  ONE: "one",
  MULTI: "multiple",
};

// 选择事件
export const SelectEvent = {
  ONE: "selectOne",
  MULTI: "selectMultiple",
  CANCEL: "selectCancel",
};

export default { SelectMode, SelectEvent };
