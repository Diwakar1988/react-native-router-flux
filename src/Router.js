/**
 * Copyright (c) 2015-present, Pavel Aksonov
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import React, {
  Component,
  PropTypes,
} from 'react';
import { BackHandler } from 'react-native';
import NavigationExperimental from 'react-native-experimental-navigation';

import Actions, { ActionMap } from './Actions';
import getInitialStateFromRoot from './State';
import Reducer, { findElement } from './Reducer';
import DefaultRenderer from './DefaultRenderer';
import Scene from './Scene';
import * as ActionConst from './ActionConst';

const {
  RootContainer: NavigationRootContainer,
} = NavigationExperimental;

const propTypes = {
  dispatch: PropTypes.func,
  backAndroidHandler: PropTypes.func,
  onBackAndroid: PropTypes.func,
  onExitApp: PropTypes.func,
};
/**		
 * We've modified this class to fix cross funnel back problem where view stack was getting clear on back press when landing back on funnel.		
 */
class Router extends Component {
  static childContextTypes = {
    routes: PropTypes.object,
  }

  constructor(props) {
    console.log('Router::constructor')
    super(props);
    this.renderNavigation = this.renderNavigation.bind(this);
    this.handleProps = this.handleProps.bind(this);
    this.handleBackAndroid = this.handleBackAndroid.bind(this);
    const reducer = this.handleProps(props);
    this.state = { reducer };
  }

  getChildContext() {
    return {
      routes: Actions,
    };
  }

  componentDidMount() {
    BackHandler.addEventListener('hardwareBackPress', this.handleBackAndroid);
  }

  componentWillReceiveProps(props) {
    const reducer = this.handleProps(props);
    this.setState({ reducer });
  }

  componentWillUnmount() {
    BackHandler.removeEventListener('hardwareBackPress', this.handleBackAndroid);
  }

  handleBackAndroid() {
    const {
      backAndroidHandler,
      onBackAndroid,
      onExitApp,
    } = this.props;
    // optional for customizing handler
    if (backAndroidHandler) {
      return backAndroidHandler();
    }

    try {
      Actions.androidBack();
      if (onBackAndroid) {
        onBackAndroid();
      }
      return true;
    } catch (err) {
      if (onExitApp) {
        return onExitApp();
      }

      return false;
    }
  }

  handleProps(props) {
    let scenesMap;

    if (props.scenes) {
      scenesMap = props.scenes;
    } else {
      let scenes = props.children;

      if (Array.isArray(props.children) || props.children.props.component) {
        scenes = (
          <Scene
            key="__root"
            hideNav
            {...this.props}
          >
            {props.children}
          </Scene>
        );
      }
      scenesMap = Actions.create(scenes, props.wrapBy);
    }

    // eslint-disable-next-line no-unused-vars
    const { children, styles, scenes, reducer, createReducer, ...parentProps } = props;

    scenesMap.rootProps = parentProps;

    const initialState = getInitialStateFromRoot(scenesMap);
    const reducerCreator = props.createReducer || Reducer;

    const routerReducer = props.reducer || (
      reducerCreator({
        initialState,
        scenes: scenesMap,
      }));

    return routerReducer;
  }

  renderNavigation(navigationState, onNavigate) {
    console.log('@Router onNavigate=', onNavigate)
    if (!navigationState) {
      return null;
    }
    this._navigationState = navigationState
    this._onNavigate = onNavigate
    if (!this._fixedInstance) {
      this._fixedInstance = true;
      this._oldActionsGet = Actions.get;
      this._oldActionsCallback = Actions.callback;
    }
    Actions.get = key => findElement(this._navigationState, key, ActionConst.REFRESH);
    Actions.callback = (props) => {
      const constAction = (props.type && ActionMap[props.type] ? ActionMap[props.type] : null);
      if (this.props.dispatch) {
        if (constAction) {
          this.props.dispatch({ ...props, type: constAction });
        } else {
          this.props.dispatch(props);
        }
      }
      return (constAction ? onNavigate({ ...props, type: constAction }) : onNavigate(props));
    };

    return <DefaultRenderer onNavigate={this._onNavigate} navigationState={this._navigationState} />;
  }

  componentWillUnmount() {
    console.log('@Router reset Actions.get/callback')
    navigationState = this._navigationState
    Actions.get = this._oldActionsGet
    Actions.callback = this._oldActionsCallback
  }

  render() {
    if (!this.state.reducer) return null;

    return (
      <NavigationRootContainer
        reducer={this.state.reducer}
        renderNavigation={this.renderNavigation}
      />
    );
  }
}

Router.propTypes = propTypes;

export default Router;
