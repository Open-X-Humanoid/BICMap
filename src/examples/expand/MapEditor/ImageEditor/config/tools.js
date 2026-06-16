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
