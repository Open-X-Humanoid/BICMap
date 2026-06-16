import iconCart from '../../assets/icons/icon-cart.svg'
import iconEntry from '../../assets/icons/icon-entry.svg'
import iconGate from '../../assets/icons/icon-gate.svg'
import iconPlatform from '../../assets/icons/icon-platform.svg'
import iconRobotStandby from '../../assets/icons/icon-robot-standby.svg'
import iconSecurity from '../../assets/icons/icon-security.svg'
import iconSelfTicket from '../../assets/icons/icon-self-ticket.svg'
import iconServiceCenter from '../../assets/icons/icon-service-center.svg'
import iconTransfer from '../../assets/icons/icon-transfer.svg'
import iconWaiting from '../../assets/icons/icon-waiting.svg'

export const POI_ICONS = {
  'icon-entry': iconEntry,
  'icon-security': iconSecurity,
  'icon-self-ticket': iconSelfTicket,
  'icon-cart': iconCart,
  'icon-robot-standby': iconRobotStandby,
  'icon-service-center': iconServiceCenter,
  'icon-gate': iconGate,
  'icon-platform': iconPlatform,
  'icon-transfer': iconTransfer,
  'icon-waiting': iconWaiting,
}

/** 地图 POI 图标图例 */
export const POI_ICON_LEGEND = [
  { icon: 'icon-entry', label: '入口' },
  { icon: 'icon-security', label: '防爆检查' },
  { icon: 'icon-self-ticket', label: '值机/取票' },
  { icon: 'icon-cart', label: '行李提取' },
  { icon: 'icon-robot-standby', label: '机器人等待区' },
  { icon: 'icon-service-center', label: '咨询处' },
  { icon: 'icon-gate', label: '安检/登机口' },
  { icon: 'icon-transfer', label: '登机通道' },
  { icon: 'icon-waiting', label: '候机区' },
  { icon: 'icon-platform', label: '停机位' },
]
