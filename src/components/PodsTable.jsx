import React from 'react'
import _ from 'underscore'
import EventsTable from './EventsTable'
import OverlayButton from './OverlayButton'
import HelmService from './HelmService'
import EnvTable from './EnvTable'
import Info from './Info'
import Clipboard from 'react-clipboard.js'
import Loader from './Loader'
import Logs from './Logs'

import './PodsTable.css'

export default class PodsTable extends React.Component {
  constructor (props) {
    super(props)
    this.state = {
      data: this.props.data
    }
  }

  showOverlay (data, render) {
    var clickEvent = new CustomEvent('overlay_show', {
      detail: {
        json: data,
        render
      }
    })

    document.dispatchEvent(clickEvent);
  }

  handleClickLog (p, c) {
    let u = `/api/context/${this.props.context}/namespace/${this.props.namespace}/pods/${p.name}/log/${c.name}`
    let html = (<Loader url={u}><Logs /></Loader>)
    
    var logsEvent = new CustomEvent('overlay_show', { detail: { html }})
    document.dispatchEvent(logsEvent);

    // this.showOverlay({status: 'LOADING'})
    // fetch(`/api/context/${this.props.context}/namespace/${this.props.namespace}/pods/${p.name}/log/${c.name}`)
    //   .then(res => res.json())
    //   .then(
    //     (result) => {
    //       this.showOverlay({
    //         html: (<Logs data={result}></Logs>)
    //       })
    //     },
    //     (error) => {
    //       this.showOverlay({error: error})
    //     }
    //   )
  }

  handleClickPodEvents (p) {
    let data = this.state.data || this.props.data
    let pod = _.find(data.items, (pod) => p.name === pod.metadata.name)
    if (pod) {
      pod.showEvents = !pod.showEvents
    }
    this.setState({ data: this.state.data })
  }

  handleClickPort (p, c) {
    let data = {
      data: {
        'port-forward': `kubectl --context=${this.props.context} -n=${this.props.namespace} port-forward ${p.name} 8888:${c.port}`,
        'sh': `kubectl --context=${this.props.context} -n=${this.props.namespace} exec -ti ${p.name} -c ${c.name} sh`,
        'bash': `kubectl --context=${this.props.context} -n=${this.props.namespace} exec -ti ${p.name} -c ${c.name} bash`,
      },
      kind: 'ConfigMap',
      metadata: {
        name: c.name
      }
    }
    this.showOverlay(data, true)
  }

  getPodHtml (p) {
    let containersWithHtml = p.containers.map(c => {
      c.html = this.getContainerHtml(p, c)
      return c
    })
    let containerWithHTMLfirst = containersWithHtml.shift()
    let viewEventsLink = (p.events.length) ? (<a onClick={() => this.handleClickPodEvents(p)} className={p.showEvents ? 'pod__eventslink icon icon-down-open': 'pod__eventslink icon icon-right-open'}>Events</a>) : '' 

    return (
      <tbody key={p.name} className="pod">
        <tr className="pod__summary">
          <td rowSpan={p.containers.length}>
            {p.name}
            {viewEventsLink}
          </td>
          <td rowSpan={p.containers.length}>{p.readyContainers}/{p.totalContainers}</td>
          {containerWithHTMLfirst.html}
          <td rowSpan={p.containers.length}>
            <OverlayButton label="JSON" data={p.raw} />
          </td>
        </tr>
        {containersWithHtml.map(c => (
          <tr key={p.name + c.name}>{c.html}</tr>
        ))}
        <tr>
          <td colSpan="999" className={(p.showEvents && p.events) ? 'pod__events' : 'pod__events pod__events--hidden'}>
            <EventsTable data={p.events} template="pods" />
          </td>
        </tr>
      </tbody>
    )
  }

  getContainerHtml (p, c) {
    let shortcutHtml = ''
    let shortcuts = {
      'portforward': `kubectl --context=${this.props.context} -n=${this.props.namespace} port-forward ${p.name} 8888:${c.port}`,
      'sh': `kubectl --context=${this.props.context} -n=${this.props.namespace} exec -ti ${p.name} -c ${c.name} sh`,
      'bash': `kubectl --context=${this.props.context} -n=${this.props.namespace} exec -ti ${p.name} -c ${c.name} bash`,
    }

    if (!c.initContainer) {
      shortcutHtml = (<div>
        <p>port-forward (local:remote): <Clipboard data-clipboard-text={shortcuts.portforward}>{shortcuts.portforward}</Clipboard></p>
        <p>sh: <Clipboard data-clipboard-text={shortcuts.sh}>{shortcuts.sh}</Clipboard></p>
        <p>bash: <Clipboard data-clipboard-text={shortcuts.bash}>{shortcuts.bash}</Clipboard></p>
      </div>)
    }

    return [
      <td key={c.name}>
        <div className={c.classes}>
          <span className="container__links">
            <a className="container__link container__link--port" onClick={(e) => this.handleClickPort(p, c)} title="kubectl commands for port forwarding, sh and bash">{c.port}</a>
          </span>
          <Info title={c.name}>
            <p><a onClick={(e) => this.handleClickLog(p, c)} className="button" title="View logs for container">View logs for container</a></p>
            <p><OverlayButton label="View environment variables for container" html={c.envHtml} /></p>
            {shortcutHtml}
          </Info>
          <span className="container__image">{c.image}</span>
          <span className="container__msg">{c.msg}</span>
          
        </div>
      </td>,
      <td key={c.name + 'env'} className=''><OverlayButton label="ENV" html={c.envHtml} /></td>,
      <td key={c.name + 'hash'} className={c.hashClass}>{c.hash}</td>,
      <td key={c.name + 'helm'} className={c.helmClass}>{c.helmHash}</td>
    ]
  }

  getEnvHtml (c) {
    return (
      <EnvTable data={c} />
    )
  }

  render() {
    let data = this.state.data || this.props.data
    if (!data || !_.isArray(data.items)) {
      return ''
    }
      
    let helm = HelmService.getData(this.props.context)

    // EACH POD
    let podDetails = data.items.map(p =>{
      let readyCount = 0

      let initContainers = p.spec.initContainers || []
      _.each(initContainers, c => {
        c.initContainer = true
      })

      
      let allContainers = initContainers.concat(p.spec.containers)

      // EACH CONTAINER
      let containers = allContainers.map(c => {
        let status = _.findWhere(c.initContainer ? p.status.initContainerStatuses: p.status.containerStatuses, { name: c.name }) || {}
        
        readyCount+= (status.ready && !c.initContainer) ? 1 : 0
        let classes = ['container']
        let msg = ''

        if (status.ready) {
          classes.push('container--ready')
        } else {
          classes.push('container--notready')
        }

        if (_.has(status.state, 'terminated')) {
          classes.push('container--terminated')
        }

        if (_.has(status.state, 'waiting')) {
          msg = status.state.waiting.message
        }

        if (c.initContainer) {
          classes.push('container--init')
        }
        
        let port = (c && c.ports && c.ports[0]) ? c.ports[0].containerPort : ''
        let hash = c.image.replace(/[^:]*:(a-z0-9)*/i, '$1')
        let helmHash = helm[c.name] || null
        let helmClass
        let hashClass
        if (helmHash && helmHash === hash) {
          hashClass = 'container__hash container__hash--match'
          helmClass = 'container__helm container__helm--match'
        } else if (helmHash && helmHash !== hash) {
          hashClass = 'container__hash container__hash--mismatch'
          helmClass = 'container__helm container__helm--mismatch'
        } else {
          hashClass = 'container__hash'
          helmClass = 'container__helm'
        }

        return {
          name: c.name,
          ready: c.ready,
          terminated: _.has(c.state, 'terminated'),
          classes: classes.join(' '),
          msg: msg,
          image: c.image,
          hash, 
          helmHash,
          hashClass,
          helmClass,
          port,
          env: c.env,
          envHtml: this.getEnvHtml(c),
          initContainer: c.initContainer
        }
      })

      return {
        name: p.metadata.name,
        containers,
        totalContainers: p.spec.containers.length,
        readyContainers: readyCount,
        raw: p,
        events: p.events,
        showEvents: p.showEvents
      }
    })

    

    return (
      <table className="podtable">
        <thead>
          <tr className="podtable__headings">
            <th>Pod</th>
            <th></th>
            <th>Container</th>
            <th></th>
            <th>Version</th>
            <th>Helm</th>
            <th></th>
          </tr>
        </thead>
        {podDetails.map(p => this.getPodHtml(p))}
      </table>
    )
  }  
}