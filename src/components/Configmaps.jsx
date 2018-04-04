import React from 'react';

export default class Configmaps extends React.Component {
  constructor (props) {
    super(props)
    this.state = {
      isLoaded: false,
      quota: null,
      context: '',
      namespace: ''
    }
  }

  refreshConfigmaps = (cx, ns) => {
    if (!ns || !cx) {
      return
    }

    if (ns === this.state.ns && cx === this.state.context) {
      return
    }

    this.setState({
      isLoaded: false,
      configmaps: null,
      context: cx,
      namespace: ns
    })

    fetch(`/api/context/${cx}/namespace/${ns}/configmaps`)
      .then(res => res.json())
      .then(
        (result) => {
          this.setState({
            isLoaded: true,
            configmaps: result
          })
        },
        // Note: it's important to handle errors here
        // instead of a catch() block so that we don't swallow
        // exceptions from actual bugs in components.
        (error) => {
          this.setState({
            isLoaded: true,
            error
          })
        }
      )
  }

  componentDidMount() {
    this.refreshConfigmaps(this.props.match.params.context, this.props.match.params.namespace)
  }

  componentWillReceiveProps(nextProps, nextState) {
    this.refreshConfigmaps(nextProps.match.params.context, nextProps.match.params.namespace) 
  }

  handleClick (sec) {
    var clickEvent = new CustomEvent('overlay_show', {
      detail: {
        json: sec
      }
    });

    document.dispatchEvent(clickEvent);
  }

  render() {
    let configmapsSummary = ''

    if (this.state.configmaps && this.state.configmaps) {
      configmapsSummary = (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Keys</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {this.state.configmaps.map(sec => (
              <tr key={sec.metadata.name}>
                <td>{sec.metadata.name}</td>
                <td>{Object.keys(sec.data).map((key) => (<span key={key}>{key}<br /></span>))}</td>
                <td>
                  <a className="button" onClick={(e) => this.handleClick(sec)}>JSON</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )
    }
    return (
      <div>
        <h2>ConfigMaps</h2> 
        {configmapsSummary}
      </div>
    )
  }
}






