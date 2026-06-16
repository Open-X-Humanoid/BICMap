/*
 * @Author: Ella ella.yin@x-humanoid.com
 * @Date: 2025-07-16 17:29:01
 * @LastEditors: Ella ella.yin@x-humanoid.com
 * @LastEditTime: 2026-05-07 17:56:04
 * @FilePath: /bic-robobiz-admin/src/components/ImageEditor/config/tools.js
 * @Description: 一些工具参数的配置
 */

// 工具配置映射
const toolConfigs = {
  // select: {
  //   name: "select",
  //   icon: "select",
  //   title: "选择",
  //   shortcut: "V",
  //   colors: [],
  //   slider: null,
  //   showColorPicker: false,
  //   showSlider: false,
  //   showSettings: false,
  // },
  move: {
    name: "move",
    icon: "move",
    title: "拖动",
    colors: [],
    slider: null,
    showColorPicker: false,
    showSlider: false,
    showSettings: false,
  },
  pencil: {
    name: "pencil",
    icon: "pencil",
    title: "画笔",
    shortcut: "P",
    colors: [
      "#ffffff",
      "#cdcdcd",
      "#000000",
      "#1d66e1",
      "#e1edfc",
      "#b9d5eb",
      "#759ebd",
    ],
    slider: {
      min: 1,
      max: 128,
      step: 1,
      label: "大小",
      defaultValue: 5,
    },
    showColorPicker: true,
    showSlider: true,
    showSettings: true,
  },
  eraser: {
    name: "eraser",
    icon: "eraser",
    title: "橡皮",
    shortcut: "E",
    colors: [
      "#ffffff",
      "#cdcdcd",
      "#1d66e1",
      "#e1edfc",
      "#b9d5eb",
      "#759ebd",
    ],
    slider: {
      min: 5,
      max: 128,
      step: 5,
      label: "大小",
      defaultValue: 20,
    },
    showColorPicker: true,
    showSlider: true,
    showSettings: true,
  },


};

const pencilBrushTypeList = [
  {
    type: "free",
    label: "自由画笔",
  },
  {
    type: "line",
    label: "直线画笔",
  }  
];

export {toolConfigs, pencilBrushTypeList } ;
