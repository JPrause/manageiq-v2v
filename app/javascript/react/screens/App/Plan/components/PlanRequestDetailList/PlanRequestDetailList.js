import React from 'react';
import PropTypes from 'prop-types';
import {
  Button,
  Icon,
  Grid,
  FormGroup,
  ListView,
  Popover,
  OverlayTrigger,
  Spinner,
  Toolbar,
  Tooltip,
  UtilizationBar,
  DropdownButton,
  MenuItem
} from 'patternfly-react';
import { formatDateTime } from '../../../../../../components/dates/MomentDate';
import { V2V_MIGRATION_STATUS_MESSAGES, REQUEST_TASKS_URL } from '../../PlanConstants';
import TickingIsoElapsedTime from '../../../../../../components/dates/TickingIsoElapsedTime';
import ConfirmModal from '../../../common/ConfirmModal';

class PlanRequestDetailList extends React.Component {
  state = {
    showConfirmCancel: false
  };

  componentDidUpdate(prevProps, prevState) {
    if (prevProps.planRequestTasks !== this.props.planRequestTasks) {
      const {
        failedMigrations,
        successfulMigrations,
        notificationsSentList,
        dispatchVMTasksCompletionNotificationAction
      } = this.props;
      dispatchVMTasksCompletionNotificationAction(failedMigrations, successfulMigrations, notificationsSentList);
    }
  }

  onSelect = (eventKey, task) => {
    const { downloadLogAction, fetchOrchestrationStackUrl, fetchOrchestrationStackAction } = this.props;
    if (eventKey === 'migration') {
      downloadLogAction(task, 'v2v');
    } else if (eventKey === 'wrapper') {
      downloadLogAction(task, 'wrapper');
    } else {
      fetchOrchestrationStackAction(fetchOrchestrationStackUrl, eventKey, task);
    }
  };

  overlayTriggerClick = task => {
    if (!this.props.conversionHosts[task.id]) {
      this.props.fetchConversionHostAction(this.props.fetchConversionHostUrl, task.id);
    }

    if (task.options.playbooks) {
      const playbookStatuses = task.options.playbooks;
      let runningPlaybook = null;

      for (const scheduleType in playbookStatuses) {
        if (playbookStatuses[scheduleType].job_state === 'active') {
          runningPlaybook = scheduleType;
        }
      }

      if (runningPlaybook) {
        const {
          plan: {
            options: { config_info }
          },
          fetchAnsiblePlaybookTemplateUrl,
          fetchAnsiblePlaybookTemplateAction
        } = this.props;
        const configInfoKey = `${runningPlaybook}_service_id`;

        fetchAnsiblePlaybookTemplateAction(fetchAnsiblePlaybookTemplateUrl, config_info[configInfoKey]);
      }
    }
  };

  getCancelSelectionState = () => {
    const { selectedTasksForCancel, markedForCancellation, filteredListItems } = this.props;
    const incompleteTasks = filteredListItems.filter(
      task => !task.completed && !task.cancelation_status && !markedForCancellation.find(t => t.id === task.id)
    );
    return {
      incompleteTasks,
      allSelected: selectedTasksForCancel.length === incompleteTasks.length && selectedTasksForCancel.length > 0,
      noneSelected: selectedTasksForCancel.length === 0
    };
  };

  handleCheckboxChange = task => {
    const { selectedTasksForCancel, updateSelectedTasksForCancelAction } = this.props;
    const selectedTask = selectedTasksForCancel.find(t => t.id === task.id);
    let updatedSelectedTasks;
    if (selectedTask) {
      updatedSelectedTasks = selectedTasksForCancel.filter(r => !(r.id === task.id));
    } else {
      updatedSelectedTasks = [...selectedTasksForCancel, task];
    }
    updateSelectedTasksForCancelAction(updatedSelectedTasks);
  };

  handleSelectAllCheckboxChange = () => {
    const { allSelected } = this.getCancelSelectionState();
    if (allSelected) {
      this.deselectAllTasks();
    } else {
      this.selectAllInProgressTasks();
    }
  };

  taskIsSelected = task => {
    const { selectedTasksForCancel } = this.props;
    return selectedTasksForCancel.findIndex(t => t.id === task.id) > -1;
  };

  selectAllInProgressTasks = () => {
    const { incompleteTasks } = this.getCancelSelectionState();
    const { updateSelectedTasksForCancelAction } = this.props;
    updateSelectedTasksForCancelAction(incompleteTasks);
  };

  deselectAllTasks = () => {
    const { deleteAllSelectedTasksForCancelAction } = this.props;
    deleteAllSelectedTasksForCancelAction();
  };

  onCancelMigrationsCancel = () => {
    this.setState({ showConfirmCancel: false });
  };

  onCancelMigrationsClick = () => {
    this.setState({ showConfirmCancel: true });
  };

  onCancelMigrationsConfirm = () => {
    // todo: call this from the Confirmation Modal instead
    // gather the selected tasks in state and feed them through
    const { selectedTasksForCancel } = this.props;
    const { cancelPlanRequestTasksAction, cancelPlanRequestTasksUrl } = this.props;
    cancelPlanRequestTasksAction(cancelPlanRequestTasksUrl, selectedTasksForCancel);
    this.setState({ showConfirmCancel: false });
  };

  render() {
    const { showConfirmCancel } = this.state;

    const {
      downloadLogInProgressTaskIds,
      ansiblePlaybookTemplate,
      planRequestTasks,
      selectedTasksForCancel,
      markedForCancellation,
      filteredSortedPaginatedListItems,
      renderFilterControls,
      renderSortControls,
      renderActiveFilters,
      renderPaginationRow,
      conversionHosts
    } = this.props;

    const { allSelected, noneSelected } = this.getCancelSelectionState();

    const totalNumTasks = planRequestTasks.length;

    const selectAllCheckbox = (
      <input
        type="checkbox"
        checked={allSelected}
        onClick={event => {
          // Don't open the dropdown when clicking directly on the checkbox.
          event.stopPropagation();
        }}
        onChange={this.handleSelectAllCheckboxChange}
      />
    );

    return (
      <React.Fragment>
        <Grid.Row>
          <Toolbar>
            <FormGroup style={{ paddingLeft: 0 }}>
              <DropdownButton title={selectAllCheckbox} id="bulk-selector">
                <MenuItem eventKey="1" disabled={allSelected} onClick={this.selectAllInProgressTasks}>
                  {__('Select All')}
                </MenuItem>
                <MenuItem eventKey="2" disabled={noneSelected} onClick={this.deselectAllTasks}>
                  {__('Select None')}
                </MenuItem>
              </DropdownButton>
            </FormGroup>
            {renderFilterControls({ style: { paddingLeft: 20 } })}
            {renderSortControls()}
            <Toolbar.RightContent>
              <Button disabled={selectedTasksForCancel.length === 0} onClick={this.onCancelMigrationsClick}>
                {__('Cancel Migration')}
              </Button>
            </Toolbar.RightContent>
            {renderActiveFilters(filteredSortedPaginatedListItems)}
          </Toolbar>
          {selectedTasksForCancel.length > 0 && (
            <Toolbar>
              <Toolbar.RightContent>
                {sprintf(__('%s of %s selected'), selectedTasksForCancel.length, totalNumTasks)}
              </Toolbar.RightContent>
            </Toolbar>
          )}
        </Grid.Row>
        <div style={{ overflow: 'auto', paddingBottom: 300, height: '100%' }}>
          <ListView className="plan-request-details-list">
            {filteredSortedPaginatedListItems.items.map((task, n) => {
              let taskMessage = task.message;
              let taskCancelled = false;

              if (markedForCancellation.find(t => t.id === task.id)) {
                taskMessage = `${task.message}: ${__('Cancel request sent')}`;
                taskCancelled = true;
              }
              switch (task.cancelation_status) {
                case 'cancel_requested':
                  taskMessage = `${task.message}: ${__('Cancel requested')}`;
                  taskCancelled = true;
                  break;
                case 'canceling':
                  taskMessage = `${task.message}: ${__('Canceling')}`;
                  taskCancelled = true;
                  break;
                case 'canceled':
                  taskMessage = `${task.message}: ${__('Canceled')}`;
                  taskCancelled = true;
                  break;
                default:
                  taskCancelled = false;
              }

              let leftContent;
              if (task.message === 'Pending') {
                leftContent = (
                  <ListView.Icon
                    type="pf"
                    name="pending"
                    size="md"
                    style={{ width: 'inherit', backgroundColor: 'transparent' }}
                  />
                );
              } else if (taskCancelled && task.completed) {
                taskMessage = `${task.message}: ${__('Migration cancelled')}`;
                leftContent = (
                  <ListView.Icon
                    type="fa"
                    name="ban"
                    size="md"
                    style={{ width: 'inherit', backgroundColor: 'transparent' }}
                  />
                );
              } else if (task.completed && !task.completedSuccessfully) {
                leftContent = (
                  <ListView.Icon
                    type="pf"
                    name="error-circle-o"
                    size="md"
                    style={{ width: 'inherit', backgroundColor: 'transparent' }}
                  />
                );
              } else if (task.completed) {
                leftContent = (
                  <ListView.Icon
                    type="pf"
                    name="ok"
                    size="md"
                    style={{ width: 'inherit', backgroundColor: 'transparent' }}
                  />
                );
              } else {
                leftContent = <Spinner loading />;
              }
              const label = sprintf(__('%s of %s Migrated'), task.diskSpaceCompletedGb, task.totalDiskSpaceGb);

              const popoverContent = (
                <Popover
                  id={`popover${task.id}${n}`}
                  title={V2V_MIGRATION_STATUS_MESSAGES[task.message]}
                  className="task-info-popover no-max-width"
                >
                  <div>
                    <div>
                      <b>{__('Start Time')}: </b>
                      {formatDateTime(task.startDateTime)}
                    </div>
                    <div>
                      <b>{__('Conversion Host')}: </b>
                      {conversionHosts[task.id] && conversionHosts[task.id].name}
                    </div>
                    <br />
                    <div>
                      <strong>{__('Status Detail')}: </strong>
                      {task.options.progress &&
                        task.options.progress.current_state &&
                        task.options.progress.states &&
                        task.options.progress.states[task.options.progress.current_state].message}
                    </div>
                    {task.log_available && (
                      <div>
                        <br />
                        <strong>{__('Log:')}</strong>
                        <br />
                        {task.options.virtv2v_wrapper.v2v_log}
                      </div>
                    )}
                  </div>
                </Popover>
              );

              const statusMessage =
                task.options.prePlaybookRunning || task.options.postPlaybookRunning ? (
                  <div>
                    <b>{__('Running playbook service')}: </b>
                    {ansiblePlaybookTemplate.name}
                  </div>
                ) : (
                  <div>
                    <b>{__('Status')}: </b>
                    {task.options.progress && V2V_MIGRATION_STATUS_MESSAGES[task.options.progress.current_description]}
                  </div>
                );
              return (
                <ListView.Item
                  key={task.id}
                  checkboxInput={
                    <input
                      type="checkbox"
                      disabled={taskCancelled || task.completed}
                      checked={this.taskIsSelected(task)}
                      onChange={() => {
                        this.handleCheckboxChange(task);
                      }}
                    />
                  }
                  leftContent={leftContent}
                  heading={task.vmName}
                  additionalInfo={[
                    <ListView.InfoItem
                      key={`${task.id}-message`}
                      style={{
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        marginRight: 80,
                        minWidth: 200
                      }}
                    >
                      <div>
                        <div style={{ display: 'inline-block', textAlign: 'left' }}>
                          <span>{taskMessage}</span>
                          {statusMessage}
                        </div>
                        &nbsp;
                        {/* Todo: revisit FieldLevelHelp props in patternfly-react to support this */}
                        <OverlayTrigger
                          rootClose
                          trigger="click"
                          onEnter={() => this.overlayTriggerClick(task)}
                          placement="left"
                          overlay={popoverContent}
                        >
                          <Button bsStyle="link">
                            <Icon type="pf" name="info" />
                          </Button>
                        </OverlayTrigger>
                      </div>
                      <div>
                        <ListView.Icon type="fa" size="lg" name="clock-o" />
                        <TickingIsoElapsedTime
                          startTime={task.startDateTime}
                          endTime={task.completed ? task.lastUpdateDateTime : null}
                        />
                      </div>
                    </ListView.InfoItem>,
                    <ListView.InfoItem key={`${task.id}-times`} style={{ minWidth: 150, paddingRight: 20 }}>
                      <UtilizationBar
                        now={task.percentComplete}
                        min={0}
                        max={100}
                        description={label}
                        label=" "
                        usedTooltipFunction={(max, now) => (
                          <Tooltip id={Date.now()}>
                            {now} % {__('Migrated')}
                          </Tooltip>
                        )}
                        availableTooltipFunction={(max, now) => (
                          <Tooltip id={Date.now()}>
                            {max - now} % {__('Remaining')}
                          </Tooltip>
                        )}
                        descriptionPlacementTop
                      />
                    </ListView.InfoItem>
                  ]}
                  actions={
                    <DropdownButton
                      id={`${task.id}-${task.descriptionPrefix}_download_log_dropdown`}
                      title={__('Download Log')}
                      pullRight
                      onSelect={eventKey => this.onSelect(eventKey, task)}
                      disabled={
                        !task.log_available ||
                        (downloadLogInProgressTaskIds &&
                          downloadLogInProgressTaskIds.find(element => element === task.id) &&
                          !task.options.prePlaybookComplete &&
                          !task.options.postPlaybookComplete)
                      }
                    >
                      {task.options.prePlaybookComplete && (
                        <MenuItem
                          eventKey="preMigration"
                          disabled={downloadLogInProgressTaskIds && downloadLogInProgressTaskIds.indexOf(task.id) > -1}
                        >
                          {__('Premigration log')}
                        </MenuItem>
                      )}
                      <MenuItem
                        eventKey="migration"
                        disabled={downloadLogInProgressTaskIds && downloadLogInProgressTaskIds.indexOf(task.id) > -1}
                      >
                        {__('Migration log')}
                      </MenuItem>
                      <MenuItem
                        eventKey="wrapper"
                        disabled={downloadLogInProgressTaskIds && downloadLogInProgressTaskIds.indexOf(task.id) > -1}
                      >
                        {__('Virt-v2v-wrapper log')}
                      </MenuItem>
                      {task.options.postPlaybookComplete && (
                        <MenuItem
                          eventKey="postMigration"
                          disabled={downloadLogInProgressTaskIds && downloadLogInProgressTaskIds.indexOf(task.id) > -1}
                        >
                          {__('Postmigration log')}
                        </MenuItem>
                      )}
                    </DropdownButton>
                  }
                  stacked
                />
              );
            })}
          </ListView>
          {renderPaginationRow(filteredSortedPaginatedListItems)}
        </div>
        <ConfirmModal
          show={showConfirmCancel}
          title={__('Cancel Migrations')}
          body={
            <React.Fragment>
              <p>
                {__('If you cancel, these VMs will not be migrated and will be fully restored in the source provider.')}
              </p>
              <ul>
                {selectedTasksForCancel.map(task => (
                  <li key={task.id}>{task.vmName}</li>
                ))}
              </ul>
              <p>{__('Do you want to cancel?')}</p>
            </React.Fragment>
          }
          cancelButtonLabel={__('No')}
          confirmButtonLabel={__('Cancel Migrations')}
          onConfirm={this.onCancelMigrationsConfirm}
          onCancel={this.onCancelMigrationsCancel}
        />
      </React.Fragment>
    );
  }
}

PlanRequestDetailList.propTypes = {
  planRequestTasks: PropTypes.array,
  downloadLogAction: PropTypes.func,
  downloadLogInProgressTaskIds: PropTypes.array,
  plan: PropTypes.object,
  fetchAnsiblePlaybookTemplateUrl: PropTypes.string,
  fetchAnsiblePlaybookTemplateAction: PropTypes.func,
  ansiblePlaybookTemplate: PropTypes.object,
  fetchOrchestrationStackUrl: PropTypes.string,
  fetchOrchestrationStackAction: PropTypes.func,
  cancelPlanRequestTasksAction: PropTypes.func,
  cancelPlanRequestTasksUrl: PropTypes.string,
  selectedTasksForCancel: PropTypes.array,
  updateSelectedTasksForCancelAction: PropTypes.func,
  deleteAllSelectedTasksForCancelAction: PropTypes.func,
  markedForCancellation: PropTypes.array,
  failedMigrations: PropTypes.array,
  successfulMigrations: PropTypes.array,
  notificationsSentList: PropTypes.array,
  dispatchVMTasksCompletionNotificationAction: PropTypes.func,
  filteredListItems: PropTypes.array,
  filteredSortedPaginatedListItems: PropTypes.object,
  renderFilterControls: PropTypes.func,
  renderSortControls: PropTypes.func,
  renderActiveFilters: PropTypes.func,
  renderPaginationRow: PropTypes.func,
  conversionHosts: PropTypes.object,
  fetchConversionHostAction: PropTypes.func,
  fetchConversionHostUrl: PropTypes.string
};

PlanRequestDetailList.defaultProps = {
  fetchConversionHostUrl: REQUEST_TASKS_URL
};

export default PlanRequestDetailList;
