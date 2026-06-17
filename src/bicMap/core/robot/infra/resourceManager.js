/**
 * 资源类型常量
 */
export const ResourceType = {
  ELEVATOR: 'elevator',
  CHARGER: 'charger',
  PATH_SEGMENT: 'path_segment',
  GATE: 'gate',
  ZONE: 'zone',
}

/**
 * 资源锁
 */
export class ResourceLock {
  constructor(resourceType, resourceId, robotId) {
    this.resourceType = resourceType
    this.resourceId = resourceId
    this.robotId = robotId
    this.acquiredAt = Date.now()
    this._released = false
  }

  isReleased() {
    return this._released
  }
}

/**
 * 资源状态
 */
const ResourceStatus = {
  FREE: 'free',
  BUSY: 'busy',
  SHARED: 'shared',
}

/**
 * 资源管理器 — 管理共享资源的分配与释放
 */
export class ResourceManager {
  constructor() {
    // resourceKey -> { status, robotId, queue: [{robotId, resolve}] }
    this._resources = new Map()
  }

  /**
   * 生成资源 key
   * @param {string} resourceType
   * @param {string} resourceId
   * @returns {string}
   */
  _makeKey(resourceType, resourceId) {
    return `${resourceType}:${resourceId}`
  }

  /**
   * 初始化一个资源（如果尚未注册）
   * @param {string} resourceType
   * @param {string} resourceId
   */
  registerResource(resourceType, resourceId) {
    const key = this._makeKey(resourceType, resourceId)
    if (!this._resources.has(key)) {
      this._resources.set(key, {
        status: ResourceStatus.FREE,
        robotId: null,
        queue: [],
      })
    }
  }

  /**
   * 请求获取资源
   * @param {string} resourceType
   * @param {string} resourceId
   * @param {string} robotId
   * @param {Object} [options]
   * @param {boolean} [options.shared=false] - 是否共享模式
   * @returns {Promise<ResourceLock>}
   */
  acquire(resourceType, resourceId, robotId, options = {}) {
    const key = this._makeKey(resourceType, resourceId)
    this.registerResource(resourceType, resourceId)
    const resource = this._resources.get(key)

    if (resource.status === ResourceStatus.FREE) {
      resource.status = options.shared ? ResourceStatus.SHARED : ResourceStatus.BUSY
      resource.robotId = robotId
      return Promise.resolve(new ResourceLock(resourceType, resourceId, robotId))
    }

    if (options.shared && resource.status === ResourceStatus.SHARED) {
      return Promise.resolve(new ResourceLock(resourceType, resourceId, robotId))
    }

    // 资源被占用，排队等待
    return new Promise((resolve) => {
      resource.queue.push({ robotId, resolve, shared: !!options.shared })
    })
  }

  /**
   * 释放资源
   * @param {ResourceLock} lock
   */
  release(lock) {
    if (lock.isReleased()) return
    const key = this._makeKey(lock.resourceType, lock.resourceId)
    const resource = this._resources.get(key)
    if (!resource) return

    lock._released = true

    if (resource.queue.length > 0) {
      // 唤醒下一个等待者
      const next = resource.queue.shift()
      resource.robotId = next.robotId
      resource.status = next.shared ? ResourceStatus.SHARED : ResourceStatus.BUSY
      next.resolve(new ResourceLock(lock.resourceType, lock.resourceId, next.robotId))
    } else {
      resource.status = ResourceStatus.FREE
      resource.robotId = null
    }
  }

  /**
   * 获取资源当前状态
   * @param {string} resourceType
   * @param {string} resourceId
   * @returns {{ status: string, robotId: string|null, queueLength: number }}
   */
  getStatus(resourceType, resourceId) {
    const key = this._makeKey(resourceType, resourceId)
    const resource = this._resources.get(key)
    if (!resource) {
      return { status: ResourceStatus.FREE, robotId: null, queueLength: 0 }
    }
    return {
      status: resource.status,
      robotId: resource.robotId,
      queueLength: resource.queue.length,
    }
  }
}
